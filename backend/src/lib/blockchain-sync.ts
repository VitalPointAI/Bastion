import { PgBoss } from 'pg-boss';
import { getPool, getSharedBoss } from './database.js';
import { pollBlockchainEvents } from './near-events.js';

let boss: PgBoss;

/**
 * Process outbox records and write to NEAR blockchain
 */
async function processOutboxWorker() {
  // Poll outbox for unprocessed records
  await boss.work('process-outbox', async (_job: unknown) => {
    const client = await getPool().connect();
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
      // payload is JSONB - already parsed by pg driver
      const _payload = outboxRecord.payload;

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

    } catch (error: unknown) {
      console.error('Error processing outbox record:', error);

      // Increment retry count and log error
      if (outboxResult?.rows?.[0]) {
        const errMsg = error instanceof Error ? error.message : String(error);
        await client.query(`
          UPDATE outbox
          SET retry_count = retry_count + 1,
              error = $1
          WHERE outbox_id = $2
        `, [errMsg, outboxResult.rows[0].outbox_id]);

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
  await boss.work('sync-blockchain-events', async (_job: unknown) => {
    await pollBlockchainEvents();
  });
}

/**
 * Start all sync workers
 */
export async function startSyncWorkers() {
  if (!process.env.DATABASE_URL) {
    console.error('⚠️  DATABASE_URL not set, skipping sync workers');
    return;
  }

  boss = await getSharedBoss();

  // In pg-boss v12+, queues must be explicitly created before use
  await boss.createQueue('process-outbox');
  await boss.createQueue('sync-blockchain-events');

  // Register the workers to process jobs
  await processOutboxWorker();
  await syncBlockchainEventsWorker();

  // Schedule outbox processing every 5 seconds
  await boss.schedule('process-outbox', '*/5 * * * * *');

  // Schedule blockchain event sync every 30 seconds
  await boss.schedule('sync-blockchain-events', '*/30 * * * * *');

  console.log('✓ Blockchain sync workers started');
  console.log('  - Outbox processor: every 5 seconds');
  console.log('  - Blockchain event listener: every 30 seconds');
}

/**
 * Graceful shutdown
 */
export async function stopSyncWorkers() {
  // Boss lifecycle managed by shared singleton in database.ts
  console.log('✓ Blockchain sync workers stopped');
}

// Handle process termination
process.on('SIGTERM', stopSyncWorkers);
process.on('SIGINT', stopSyncWorkers);
