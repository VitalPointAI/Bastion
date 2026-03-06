/**
 * Team Registry
 *
 * Manages agent team registration, membership, and lifecycle.
 * Implements singleton pattern for global access.
 */

import { createTeamDID } from './tool-did.js';
import { getAgentRegistry } from './registry.js';
import type {
  AgentTeam,
  TeamMember,
} from './types.js';
import {
  AgentTeamInputSchema,
  AgentTeamUpdateSchema,
  type AgentTeamInput,
  type AgentTeamUpdate,
} from './character-schema.js';

/**
 * Team Registry - manages team lifecycle, membership, and workflows.
 */
export class TeamRegistry {
  private teams: Map<string, AgentTeam> = new Map();
  private agentTeams: Map<string, Set<string>> = new Map(); // agentId -> teamIds
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start async initialization
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the registry asynchronously.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Ensure initialization is complete before operations.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // ==========================================================================
  // Team Registration
  // ==========================================================================

  /**
   * Create a new team.
   * Automatically generates DID.
   * Validates that all member agents exist.
   * Returns the created team with DID fields populated.
   */
  async createTeam(input: AgentTeamInput, createdBy: string): Promise<AgentTeam> {
    // Validate input
    const parseResult = AgentTeamInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(`Invalid team input: ${parseResult.error.message}`);
    }

    const validInput = parseResult.data;

    if (this.teams.has(validInput.teamId)) {
      throw new Error(`Team ${validInput.teamId} already exists`);
    }

    // Validate all member agents exist
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();

    for (const member of validInput.members) {
      const agent = agentRegistry.getAgent(member.agentId);
      if (!agent) {
        throw new Error(`Agent ${member.agentId} not found`);
      }
    }

    // Check for circular dependencies (agent can't be in multiple coordinator roles)
    const coordinators = validInput.members.filter(m => m.role === 'coordinator');
    if (coordinators.length > 1) {
      // Warn but allow - hierarchical teams may have multiple coordinators
      console.warn(`Team ${validInput.teamId} has ${coordinators.length} coordinators`);
    }

    // Generate DID
    const didResult = await createTeamDID(validInput.teamId);

    const team: AgentTeam = {
      teamId: validInput.teamId,
      teamDID: didResult.did,
      teamBlindedKey: didResult.blindedKey,
      teamPublicKey: didResult.publicKey,
      name: validInput.name,
      description: validInput.description,
      purpose: validInput.purpose,
      members: validInput.members.map(m => ({
        agentId: m.agentId,
        role: m.role,
        responsibilities: m.responsibilities || [],
        canInitiate: m.canInitiate ?? false,
        canEscalate: m.canEscalate ?? true,
      })),
      workflow: {
        type: validInput.workflow.type,
        stages: validInput.workflow.stages || [],
        humanCheckpoints: validInput.workflow.humanCheckpoints || [],
      },
      sharedContext: validInput.sharedContext || [],
      escalationPolicy: validInput.escalationPolicy || {
        enabled: true,
        timeoutSeconds: 3600,
        targets: [],
        notificationChannels: [],
      },
      maxConcurrency: validInput.maxConcurrency ?? 5,
      isEnabled: validInput.isEnabled ?? true,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    this.teams.set(team.teamId, team);

    // Update agent-team mapping
    for (const member of team.members) {
      let teamSet = this.agentTeams.get(member.agentId);
      if (!teamSet) {
        teamSet = new Set();
        this.agentTeams.set(member.agentId, teamSet);
      }
      teamSet.add(team.teamId);
    }

    return team;
  }

  /**
   * Get a team by ID.
   */
  getTeam(teamId: string): AgentTeam | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Get a team by DID.
   */
  getTeamByDID(did: string): AgentTeam | undefined {
    for (const team of this.teams.values()) {
      if (team.teamDID === did) {
        return team;
      }
    }
    return undefined;
  }

  /**
   * List all teams.
   */
  listTeams(): AgentTeam[] {
    return Array.from(this.teams.values());
  }

  /**
   * Update a team's configuration.
   */
  async updateTeam(teamId: string, updates: AgentTeamUpdate): Promise<AgentTeam | undefined> {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    // Validate updates
    const parseResult = AgentTeamUpdateSchema.safeParse(updates);
    if (!parseResult.success) {
      throw new Error(`Invalid team update: ${parseResult.error.message}`);
    }

    const validUpdates = parseResult.data;

    // If members are being updated, validate all agents exist
    if (validUpdates.members) {
      const agentRegistry = getAgentRegistry();
      await agentRegistry.ensureInitialized();

      // Remove old mappings
      for (const member of team.members) {
        const teamSet = this.agentTeams.get(member.agentId);
        if (teamSet) {
          teamSet.delete(teamId);
          if (teamSet.size === 0) {
            this.agentTeams.delete(member.agentId);
          }
        }
      }

      // Validate new members
      for (const member of validUpdates.members) {
        const agent = agentRegistry.getAgent(member.agentId);
        if (!agent) {
          throw new Error(`Agent ${member.agentId} not found`);
        }
      }
    }

    const updatedTeam: AgentTeam = {
      ...team,
      ...validUpdates,
      members: validUpdates.members
        ? validUpdates.members.map(m => ({
            agentId: m.agentId,
            role: m.role,
            responsibilities: m.responsibilities || [],
            canInitiate: m.canInitiate ?? false,
            canEscalate: m.canEscalate ?? true,
          }))
        : team.members,
    };

    this.teams.set(teamId, updatedTeam);

    // Update agent-team mapping if members changed
    if (validUpdates.members) {
      for (const member of updatedTeam.members) {
        let teamSet = this.agentTeams.get(member.agentId);
        if (!teamSet) {
          teamSet = new Set();
          this.agentTeams.set(member.agentId, teamSet);
        }
        teamSet.add(teamId);
      }
    }

    return updatedTeam;
  }

  /**
   * Delete a team.
   */
  deleteTeam(teamId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) {
      return false;
    }

    // Remove from agent-team mappings
    for (const member of team.members) {
      const teamSet = this.agentTeams.get(member.agentId);
      if (teamSet) {
        teamSet.delete(teamId);
        if (teamSet.size === 0) {
          this.agentTeams.delete(member.agentId);
        }
      }
    }

    this.teams.delete(teamId);
    return true;
  }

  // ==========================================================================
  // Member Management
  // ==========================================================================

  /**
   * Add a member to a team.
   */
  async addMember(teamId: string, member: TeamMember): Promise<AgentTeam | undefined> {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    // Check if agent already in team
    if (team.members.some(m => m.agentId === member.agentId)) {
      throw new Error(`Agent ${member.agentId} is already a member of team ${teamId}`);
    }

    // Validate agent exists
    const agentRegistry = getAgentRegistry();
    await agentRegistry.ensureInitialized();
    const agent = agentRegistry.getAgent(member.agentId);
    if (!agent) {
      throw new Error(`Agent ${member.agentId} not found`);
    }

    // Add member
    const newMember: TeamMember = {
      agentId: member.agentId,
      role: member.role,
      responsibilities: member.responsibilities || [],
      canInitiate: member.canInitiate ?? false,
      canEscalate: member.canEscalate ?? true,
    };

    team.members.push(newMember);
    this.teams.set(teamId, team);

    // Update agent-team mapping
    let teamSet = this.agentTeams.get(member.agentId);
    if (!teamSet) {
      teamSet = new Set();
      this.agentTeams.set(member.agentId, teamSet);
    }
    teamSet.add(teamId);

    return team;
  }

  /**
   * Remove a member from a team.
   */
  removeMember(teamId: string, agentId: string): AgentTeam | undefined {
    const team = this.teams.get(teamId);
    if (!team) {
      return undefined;
    }

    const idx = team.members.findIndex(m => m.agentId === agentId);
    if (idx === -1) {
      throw new Error(`Agent ${agentId} is not a member of team ${teamId}`);
    }

    // Remove member
    team.members.splice(idx, 1);
    this.teams.set(teamId, team);

    // Update agent-team mapping
    const teamSet = this.agentTeams.get(agentId);
    if (teamSet) {
      teamSet.delete(teamId);
      if (teamSet.size === 0) {
        this.agentTeams.delete(agentId);
      }
    }

    return team;
  }

  /**
   * Get teams that an agent belongs to.
   */
  getTeamsForAgent(agentId: string): AgentTeam[] {
    const teamIds = this.agentTeams.get(agentId);
    if (!teamIds) {
      return [];
    }

    const teams: AgentTeam[] = [];
    for (const teamId of teamIds) {
      const team = this.teams.get(teamId);
      if (team && team.isEnabled) {
        teams.push(team);
      }
    }
    return teams;
  }

  /**
   * Get member count for a team.
   */
  getMemberCount(teamId: string): number {
    const team = this.teams.get(teamId);
    return team ? team.members.length : 0;
  }

  /**
   * Check if an agent is in a team.
   */
  isAgentInTeam(teamId: string, agentId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) {
      return false;
    }
    return team.members.some(m => m.agentId === agentId);
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let registryInstance: TeamRegistry | null = null;

/**
 * Get or create the team registry singleton.
 */
export function getTeamRegistry(): TeamRegistry {
  if (!registryInstance) {
    registryInstance = new TeamRegistry();
  }
  return registryInstance;
}
