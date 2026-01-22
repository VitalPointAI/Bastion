import { z } from 'zod';

export type WorkspaceType = 'country' | 'adversary' | 'region' | 'topic' | 'coalition' | 'custom';

export interface Workspace {
  id: string;                      // WKS-{uuid}
  name: string;
  description: string;
  type: WorkspaceType;
  parentWorkspaceId?: string;      // For hierarchical workspaces
  linkedWorkspaceIds: string[];    // Cross-references to other workspaces
  tags: string[];
  classification: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
  createdBy: string;               // DID
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export const WorkspaceInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  type: z.enum(['country', 'adversary', 'region', 'topic', 'coalition', 'custom']),
  parentWorkspaceId: z.string().optional(),
  linkedWorkspaceIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  classification: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']).default('SECRET'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type WorkspaceInput = z.infer<typeof WorkspaceInputSchema>;

export interface WorkspaceStats {
  actorCount: number;
  relationshipCount: number;
  tensionCount: number;
  objectiveCount: number;
  eventCount: number;
  alertCount: number;
}
