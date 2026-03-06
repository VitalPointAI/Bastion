/**
 * Strategic Container Types
 * Types for strategic environments, actor categories, containers, and assignments
 */

// =============================================================================
// Strategic Environment
// =============================================================================

export interface StrategicEnvironment {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Actor Categories
// =============================================================================

export interface ActorCategory {
  id: string;
  environment_id: string;
  name: string;
  color: string;
  display_order: number;
  is_default: boolean;
  created_at: Date;
}

// =============================================================================
// Strategic Containers
// =============================================================================

export interface StrategicContainer {
  id: string;
  environment_id: string;
  category_id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Container Documents (junction table)
// =============================================================================

export interface ContainerDocument {
  id: string;
  container_id: string;
  document_id: string;
  assigned_by: string;
  assigned_at: Date;
}

// =============================================================================
// Container Agent Assignments
// =============================================================================

export interface ContainerAgentAssignment {
  id: string;
  container_id: string;
  agent_id: string;
  assignment_type: string;
  auto_process_new: boolean;
  assigned_by: string;
  assigned_at: Date;
}

// =============================================================================
// Grouped view types
// =============================================================================

export interface CategoryGroup {
  category: ActorCategory;
  containers: (StrategicContainer & { document_count: number; agent_count: number })[];
}

// =============================================================================
// Container Suggestion (for AI recommendation)
// =============================================================================

export interface ContainerSuggestion {
  containerName: string;
  containerId?: string;
  confidence: number;
  reasoning: string;
}

// =============================================================================
// Default Actor Categories
// =============================================================================

export const DEFAULT_ACTOR_CATEGORIES = {
  FRIENDLY: {
    name: 'Friendly',
    color: '#2563eb',
    display_order: 0,
    description: 'Allied and coalition forces',
  },
  ADVERSARY: {
    name: 'Adversary',
    color: '#dc2626',
    display_order: 1,
    description: 'Opposing forces and hostile actors',
  },
  NEUTRAL: {
    name: 'Neutral',
    color: '#6b7280',
    display_order: 2,
    description: 'Non-aligned entities and organizations',
  },
  PARTNER: {
    name: 'Partner',
    color: '#16a34a',
    display_order: 3,
    description: 'Partner nations and cooperative entities',
  },
} as const;
