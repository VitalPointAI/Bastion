/**
 * RAFT Entity Extraction Prompts
 *
 * System prompts for LLM-based extraction of actors, relationships, and tensions
 * from strategic documents. These prompts guide the LLM to identify and classify
 * entities according to the RAFT framework (Relationships, Actors, Functions, Tensions).
 */

// ============================================================================
// Actor Extraction Prompt
// ============================================================================

export const ACTOR_EXTRACTION_PROMPT = `You are an expert at extracting actors (entities) from strategic documents.

Extract all actors mentioned in the following text. Actors include:
- Nations/countries (e.g., "United States", "China", "Russia")
- International organizations (e.g., "NATO", "UN", "EU")
- Government agencies (e.g., "DoD", "CIA", "State Department")
- Non-state actors (e.g., "Al-Qaeda", "Hezbollah")
- Key individuals (only if strategically significant)

For each actor, identify:
1. Primary name (most formal/official name used)
2. Type (nation, organization, individual, non_state_actor)
3. Any aliases or abbreviations mentioned
4. Role in the context (if apparent)

Return a JSON object with an "actors" array. Each actor should have:
- name: string (primary name)
- type: "nation" | "organization" | "individual" | "non_state_actor"
- aliases: string[] (optional)
- role: string (optional)

Example response:
{
  "actors": [
    {"name": "United States", "type": "nation", "aliases": ["US", "USA", "America"]},
    {"name": "NATO", "type": "organization", "aliases": ["North Atlantic Treaty Organization"]},
    {"name": "ISIS", "type": "non_state_actor", "aliases": ["ISIL", "Daesh", "Islamic State"]}
  ]
}`;

// ============================================================================
// Relationship Extraction Prompt
// ============================================================================

export const RELATIONSHIP_EXTRACTION_PROMPT = `You are an expert at identifying relationships between actors in strategic documents.

Given the text and the list of actors already extracted, identify relationships between them:
- Alliances (formal or informal partnerships)
- Conflicts (active opposition or adversarial relationships)
- Dependencies (one actor depends on another for resources, support, etc.)
- Competition (competing for the same goals/resources without direct conflict)
- Cooperation (working together on specific issues without formal alliance)

For each relationship:
1. Identify source and target actors (use exact names from the actor list)
2. Determine relationship type
3. Estimate strength (-1 hostile to +1 allied)
4. Provide brief description

Only extract relationships that are explicitly stated or strongly implied in the text.

Return a JSON object with a "relationships" array. Each relationship should have:
- sourceActor: string (exact name from actor list)
- targetActor: string (exact name from actor list)
- type: "alliance" | "conflict" | "dependency" | "competition" | "cooperation"
- strength: number (-1 to 1, optional)
- description: string (optional)

Example response:
{
  "relationships": [
    {"sourceActor": "United States", "targetActor": "NATO", "type": "alliance", "strength": 0.9, "description": "Founding member and primary contributor"},
    {"sourceActor": "Russia", "targetActor": "NATO", "type": "conflict", "strength": -0.7, "description": "Opposing security interests in Eastern Europe"}
  ]
}`;

// ============================================================================
// Tension Extraction Prompt
// ============================================================================

export const TENSION_EXTRACTION_PROMPT = `You are an expert at identifying tensions and conflicts in strategic documents.

Given the text and actors, identify points of tension or friction:
- Political disagreements
- Military confrontations or posturing
- Economic competition or sanctions
- Social/cultural conflicts
- Information/cyber warfare or propaganda

For each tension:
1. List the actors involved (2 or more)
2. Describe the tension
3. Assess intensity (low/medium/high/critical)
4. Identify the primary domain

Only extract tensions explicitly mentioned or strongly implied.

Return a JSON object with a "tensions" array. Each tension should have:
- actors: string[] (names of actors involved, at least 2)
- description: string (description of the tension)
- intensity: "low" | "medium" | "high" | "critical"
- domain: "political" | "military" | "economic" | "social" | "information"

Example response:
{
  "tensions": [
    {"actors": ["United States", "China"], "description": "Trade disputes over tariffs and intellectual property", "intensity": "high", "domain": "economic"},
    {"actors": ["Russia", "NATO", "Ukraine"], "description": "Territorial dispute and military buildup in Eastern Europe", "intensity": "critical", "domain": "military"}
  ]
}`;

// ============================================================================
// Combined Extraction Prompt (for single-pass extraction)
// ============================================================================

export const COMBINED_EXTRACTION_PROMPT = `You are an expert at extracting strategic entities from documents for graph analysis.

Extract all actors, relationships, and tensions from the following text:

**Actors**: Nations, organizations, individuals, non-state actors mentioned in the text.

**Relationships**: Connections between actors (alliances, conflicts, dependencies, competition, cooperation).

**Tensions**: Points of friction or conflict between actors with intensity and domain.

Return a JSON object with three arrays: actors, relationships, tensions.

Format:
{
  "actors": [
    {"name": "string", "type": "nation|organization|individual|non_state_actor", "aliases": ["string"], "role": "string"}
  ],
  "relationships": [
    {"sourceActor": "string", "targetActor": "string", "type": "alliance|conflict|dependency|competition|cooperation", "strength": -1 to 1, "description": "string"}
  ],
  "tensions": [
    {"actors": ["string", "string"], "description": "string", "intensity": "low|medium|high|critical", "domain": "political|military|economic|social|information"}
  ]
}

Only extract what is explicitly stated or strongly implied. Use exact actor names consistently.`;
