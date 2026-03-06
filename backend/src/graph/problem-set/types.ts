import { z } from 'zod';

export type GraphProblemSetCategory = 'country' | 'adversary' | 'region' | 'topic' | 'coalition' | 'custom';

export interface GraphProblemSet {
  id: string;                      // GPS-{uuid}
  name: string;
  description: string;
  type: GraphProblemSetCategory;
  parentProblemSetId?: string;     // For hierarchical problem sets
  linkedProblemSetIds: string[];   // Cross-references to other problem sets
  tags: string[];
  classification: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
  createdBy: string;               // DID
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export const GraphProblemSetInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  type: z.enum(['country', 'adversary', 'region', 'topic', 'coalition', 'custom']),
  parentProblemSetId: z.string().optional(),
  linkedProblemSetIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  classification: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']).default('SECRET'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type GraphProblemSetInput = z.infer<typeof GraphProblemSetInputSchema>;

export interface GraphProblemSetStats {
  actorCount: number;
  relationshipCount: number;
  tensionCount: number;
  objectiveCount: number;
  eventCount: number;
  alertCount: number;
}
