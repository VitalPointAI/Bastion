/**
 * Seed Positions Script
 *
 * Quick Task 9: Loads the AWC "A Way" position template into a problem set.
 *
 * Usage: npx tsx scripts/seed-positions.ts <problemSetId>
 *
 * Creates positions for all three phase structures:
 * - Competition: Unified neutral roster (JPG, regional planners, advisors)
 * - Crisis: Blue/Red split with theater command LNOs
 * - Conflict: Blue/Red with component commanders and operations subcenters
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

// Load backend .env
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const problemSetId = process.argv[2];
if (!problemSetId) {
  console.error('Usage: npx tsx scripts/seed-positions.ts <problemSetId>');
  process.exit(1);
}

// ─── Position Template Data ──────────────────────────────────────────────────

interface PositionDef {
  side: 'blue' | 'red' | 'neutral' | 'green';
  title: string;
  duties: string;
  sortOrder: number;
  phaseMappings: Array<{ exercisePhase: string; title: string; duties?: string }>;
}

const POSITIONS: PositionDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NEUTRAL — Competition Phase Unified Roster
  // From AWC reference: The Joint Planning Group operates as a single entity
  // during the Competition phase before splitting into blue/red cells.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    side: 'neutral', title: 'JPG Lead', sortOrder: 0,
    duties: 'Leads the Joint Planning Group through all phases',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'JPG Lead', duties: 'Leads the Joint Planning Group' },
      { exercisePhase: 'Crisis', title: 'CJ35 Planner', duties: 'Crisis action planning and future operations' },
      { exercisePhase: 'Conflict Day 4', title: 'CJ5', duties: 'Strategic plans and policy in conflict' },
    ],
  },
  {
    side: 'neutral', title: 'Regional Planner - Zone A', sortOrder: 1,
    duties: 'Responsible for regional analysis and planning in Zone A',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'Regional Planner - Zone A' },
      { exercisePhase: 'Crisis', title: 'Western Theater Cmd LNO', duties: 'Liaison to Western Theater Command' },
      { exercisePhase: 'Conflict Day 4', title: 'Land Ops Subcenter', duties: 'Land operations coordination' },
    ],
  },
  {
    side: 'neutral', title: 'Regional Planner - Zone B', sortOrder: 2,
    duties: 'Responsible for regional analysis and planning in Zone B',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'Regional Planner - Zone B' },
      { exercisePhase: 'Crisis', title: 'Southern Theater Cmd LNO', duties: 'Liaison to Southern Theater Command' },
      { exercisePhase: 'Conflict Day 4', title: 'Air Ops Subcenter', duties: 'Air operations coordination' },
    ],
  },
  {
    side: 'neutral', title: 'Regional Planner - Zone C', sortOrder: 3,
    duties: 'Responsible for regional analysis and planning in Zone C',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'Regional Planner - Zone C' },
      { exercisePhase: 'Crisis', title: 'Eastern Theater Cmd LNO', duties: 'Liaison to Eastern Theater Command' },
      { exercisePhase: 'Conflict Day 4', title: 'Maritime Ops Subcenter', duties: 'Maritime operations coordination' },
    ],
  },
  {
    side: 'neutral', title: 'Military Exercise Planner', sortOrder: 4,
    duties: 'Plans and coordinates military exercise components',
    phaseMappings: [],
  },
  {
    side: 'neutral', title: 'Economic Advisor', sortOrder: 5,
    duties: 'Provides economic analysis and policy recommendations',
    phaseMappings: [],
  },
  {
    side: 'neutral', title: 'DoS Representative', sortOrder: 6,
    duties: 'State Department liaison for interagency coordination',
    phaseMappings: [],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLUE — Blue Force Positions
  // From AWC reference: Blue cell forms during Crisis phase with service LNOs,
  // then transitions to component commanders in Conflict phase.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    side: 'blue', title: 'Commander', sortOrder: 0,
    duties: 'Overall blue force commander',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'Blue Cell Lead', duties: 'Leads blue cell during crisis phase' },
      { exercisePhase: 'Conflict Day 4', title: 'Commander', duties: 'Blue force commander in conflict' },
    ],
  },
  {
    side: 'blue', title: 'USARPAC LNO', sortOrder: 1,
    duties: 'U.S. Army Pacific liaison officer',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'USARPAC LNO', duties: 'Army Pacific liaison' },
      { exercisePhase: 'Conflict Day 4', title: 'CJFLCC', duties: 'Combined Joint Force Land Component Commander' },
    ],
  },
  {
    side: 'blue', title: 'PACFLT/MARFORPAC LNO', sortOrder: 2,
    duties: 'Pacific Fleet / Marine Forces Pacific liaison',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'PACFLT/MARFORPAC LNO', duties: 'Naval/Marine liaison' },
      { exercisePhase: 'Conflict Day 4', title: 'CJFMCC', duties: 'Combined Joint Force Maritime Component Commander' },
    ],
  },
  {
    side: 'blue', title: 'PACAF LNO', sortOrder: 3,
    duties: 'Pacific Air Forces liaison officer',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'PACAF LNO', duties: 'Air Forces Pacific liaison' },
      { exercisePhase: 'Conflict Day 4', title: 'CJFACC', duties: 'Combined Joint Force Air Component Commander' },
    ],
  },
  {
    side: 'blue', title: 'J4/TRANSCOM LNO', sortOrder: 4,
    duties: 'Logistics and transportation liaison',
    phaseMappings: [],
  },
  {
    side: 'blue', title: 'Intel/Enablers', sortOrder: 5,
    duties: 'Intelligence and enabler coordination',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'CJ3', duties: 'Combined Joint Operations directorate' },
    ],
  },
  {
    side: 'blue', title: 'DoS Rep (Blue)', sortOrder: 6,
    duties: 'State Department representative for blue cell',
    phaseMappings: [],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RED — Red Force (Adversary) Positions
  // From AWC reference: Red cell mirrors adversary command structure,
  // transitioning from theater commands to operations subcenters.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    side: 'red', title: 'Red Cell Lead', sortOrder: 0,
    duties: 'Leads the red cell adversary team',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'JPG Lead (Red)', duties: 'Red cell planning lead during crisis' },
      { exercisePhase: 'Conflict Day 4', title: 'Commander (Red)', duties: 'Red force commander in conflict' },
    ],
  },
  {
    side: 'red', title: 'CJ35 Planner (Red)', sortOrder: 1,
    duties: 'Red cell future plans',
    phaseMappings: [],
  },
  {
    side: 'red', title: 'Eastern Theater Cmd LNO', sortOrder: 2,
    duties: 'Eastern Theater Command liaison',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Land Ops Subcenter (Red)', duties: 'Red land operations' },
    ],
  },
  {
    side: 'red', title: 'Southern Theater Cmd LNO', sortOrder: 3,
    duties: 'Southern Theater Command liaison',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Maritime Ops Subcenter (Red)', duties: 'Red maritime operations' },
    ],
  },
  {
    side: 'red', title: 'PLA Air Force Planner', sortOrder: 4,
    duties: 'PLA Air Force planning and coordination',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Air & Air Defense Ops (Red)', duties: 'Red air and air defense operations' },
    ],
  },
  {
    side: 'red', title: 'PLA Rocket Force Planner', sortOrder: 5,
    duties: 'PLA Rocket Force planning and coordination',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Conventional Missile Ops (Red)', duties: 'Red conventional missile operations' },
    ],
  },
  {
    side: 'red', title: 'Intel/Enablers (Red)', sortOrder: 6,
    duties: 'Red cell intelligence and enabler coordination',
    phaseMappings: [],
  },
  {
    side: 'red', title: 'DoS Rep (Red)', sortOrder: 7,
    duties: 'State Department representative for red cell',
    phaseMappings: [],
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let totalPositions = 0;
    let totalMappings = 0;
    const sideCounts: Record<string, number> = { blue: 0, red: 0, neutral: 0, green: 0 };

    for (const pos of POSITIONS) {
      const posId = randomUUID();
      const now = new Date();

      await client.query(
        `INSERT INTO exercise_positions
           (id, problem_set_id, side, title, duties, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [posId, problemSetId, pos.side, pos.title, pos.duties, pos.sortOrder, now, now]
      );

      totalPositions++;
      sideCounts[pos.side]++;

      for (const mapping of pos.phaseMappings) {
        await client.query(
          `INSERT INTO exercise_position_phase_mappings
             (id, position_id, exercise_phase, title, duties)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), posId, mapping.exercisePhase, mapping.title, mapping.duties ?? null]
        );
        totalMappings++;
      }
    }

    await client.query('COMMIT');

    console.log(
      `Loaded ${totalPositions} positions ` +
      `(${sideCounts.blue} blue, ${sideCounts.red} red, ${sideCounts.neutral} neutral, ${sideCounts.green} green) ` +
      `with ${totalMappings} phase mappings ` +
      `into problem set ${problemSetId}`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
