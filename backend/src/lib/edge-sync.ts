import { getPool } from './database.js';

interface Operation {
  operation_type: string;
  payload: Record<string, unknown>;
}

/**
 * Process sync request from edge device
 */
export async function processSyncRequest(
  deviceId: string,
  operations: Operation[]
): Promise<{ success: boolean; synced_count: number }> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    for (const op of operations) {
      switch (op.operation_type) {
        case 'sensor_reading':
          await client.query(`
            INSERT INTO sensor_telemetry (
              edge_device_id, sensor_type, sensor_data, timestamp
            ) VALUES ($1, $2, $3, $4)
          `, [
            deviceId,
            op.payload.sensor_type,
            JSON.stringify(op.payload.data),
            op.payload.timestamp
          ]);
          break;

        case 'mission_update':
          await client.query(`
            INSERT INTO mission_updates (
              mission_id, update_type, update_data, created_by
            ) VALUES ($1, $2, $3, $4)
          `, [
            op.payload.mission_id,
            op.payload.update_type,
            JSON.stringify(op.payload.data),
            deviceId
          ]);
          break;

        default:
          console.warn(`Unknown operation type: ${op.operation_type}`);
      }
    }

    // Update edge device sync state
    await client.query(`
      INSERT INTO edge_sync_state (
        edge_device_id, last_sync_at, device_status
      ) VALUES ($1, NOW(), 'online')
      ON CONFLICT (edge_device_id)
      DO UPDATE SET last_sync_at = NOW(), device_status = 'online'
    `, [deviceId]);

    await client.query('COMMIT');
    return { success: true, synced_count: operations.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get updates for edge device (pull sync)
 */
export async function getSyncDelta(deviceId: string, since: string) {
  // Query for mission updates since last sync
  const result = await getPool().query(`
    SELECT * FROM mission_updates
    WHERE created_at > $1
    ORDER BY created_at ASC
  `, [since]);

  return result.rows;
}
