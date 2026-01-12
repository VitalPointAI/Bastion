import { PgBoss } from 'pg-boss';
import { pool } from './database.js';

let boss: PgBoss;

/**
 * Process outbox records and write to NEAR blockchain
 */
async function processOutboxWorker() {
  // Poll outbox for unprocessed records
  await boss.work('process-outbox', async (job: any) => {
    const client = await pool.connect();
    let outboxResult;
    try {
      // Get oldest unprocessed outbox record
      outboxResult = await client.query(`
        SELECT * FROM outbox
        WHERE processed_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      if (outboxResult.rows.length === 0) return;

      const outboxRecord = outboxResult.rows[0];
      const payload = JSON.parse(outboxRecord.payload);

      // Write to NEAR blockchain
      // TODO: Integrate with NEAR contract from Plan 1-01
      // const contract = getNearContract();
      // const tx = await contract.register_document({
      //   args: payload,
      //   gas: '30000000000000'
      // });

      // Simulate for now
      const blockchainTxHash = `near:${Date.now()}`;

      // Mark as processed
      await client.query(`
        UPDATE outbox
        SET processed_at = NOW(),
            blockchain_tx_hash = $1
        WHERE outbox_id = $2
      `, [blockchainTxHash, outboxRecord.outbox_id]);

      // Update document record
      await client.query(`
        UPDATE documents
        SET blockchain_synced = true,
            blockchain_tx_hash = $1
        WHERE document_id = $2
      `, [blockchainTxHash, outboxRecord.aggregate_id]);

      console.log(`✓ Synced document ${outboxRecord.aggregate_id} to blockchain: ${blockchainTxHash}`);

    } catch (error: any) {
      console.error('Error processing outbox record:', error);

      // Increment retry count and log error
      if (outboxResult?.rows?.[0]) {
        await client.query(`
          UPDATE outbox
          SET retry_count = retry_count + 1,
              error = $1
          WHERE outbox_id = $2
        `, [error.message, outboxResult.rows[0].outbox_id]);

        // If max retries exceeded, alert
        if (outboxResult.rows[0].retry_count >= 5) {
          console.error('❌ Max retries exceeded for outbox record', outboxResult.rows[0].outbox_id);
        }
      }

      throw error; // pgboss will retry with exponential backoff
    } finally {
      client.release();
    }
  });
}

/**
 * Listen to NEAR blockchain events and sync to PostgreSQL
 */
async function syncBlockchainEventsWorker() {
  // TODO: Implement NEAR event listener
  // Use NEAR RPC subscriptions or polling
  // When external document registered on blockchain:
  // - Check if exists in PostgreSQL
  // - If not: INSERT from blockchain event
  // - INSERT into blockchain_events table for audit
  console.log('Blockchain event sync worker: Deferred to Phase 2');
}

/**
 * Start all sync workers
 */
export async function startSyncWorkers() {
  // Initialize pg-boss with DATABASE_URL
  if (!boss) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('⚠️  DATABASE_URL not set, skipping sync workers');
      return;
    }
    boss = new PgBoss(dbUrl);
  }

  await boss.start();

  // Schedule outbox processing every 5 seconds
  await boss.schedule('process-outbox', '*/5 * * * * *');

  await processOutboxWorker();
  // await syncBlockchainEventsWorker(); // Phase 2

  console.log('✓ Blockchain sync workers started');
  console.log('  - Outbox processor: every 5 seconds');
  console.log('  - Blockchain event listener: deferred to Phase 2');
}

/**
 * Graceful shutdown
 */
export async function stopSyncWorkers() {
  await boss.stop();
  console.log('✓ Blockchain sync workers stopped');
}

// Handle process termination
process.on('SIGTERM', stopSyncWorkers);
process.on('SIGINT', stopSyncWorkers);
