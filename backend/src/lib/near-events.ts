import { JsonRpcProvider } from '@near-js/providers';
import { getPool } from './database.js';

// Type for receipt outcomes (based on NEAR RPC response)
interface ExecutionOutcomeWithId {
  id: string;
  outcome: {
    logs: string[];
    executor_id: string;
    status: unknown;
    receipt_ids: string[];
    gas_burnt: number;
  };
}

interface BlockchainEvent {
  eventType: string;
  aggregateId: string;
  eventData: Record<string, unknown>;
  blockchainTxHash: string;
  blockHeight: number;
  timestamp: number;
}

// Track last processed block to avoid reprocessing
let lastProcessedBlock: number = 0;

/**
 * Parse receipt outcomes for events emitted by our contract
 */
function parseReceiptOutcomes(
  receiptOutcomes: ExecutionOutcomeWithId[],
  txHash: string,
  blockHeight: number,
  timestamp: number
): BlockchainEvent[] {
  const events: BlockchainEvent[] = [];

  for (const outcome of receiptOutcomes) {
    // Look for logs that are JSON events (NEAR event standard)
    for (const log of outcome.outcome.logs) {
      if (log.startsWith('EVENT_JSON:')) {
        try {
          const eventData = JSON.parse(log.substring(11));

          // Map NEAR event to our event structure
          if (eventData.standard === 'nep297' || eventData.event) {
            events.push({
              eventType: eventData.event || eventData.type || 'unknown',
              aggregateId: eventData.data?.id || eventData.data?.document_hash || outcome.id,
              eventData: eventData.data || eventData,
              blockchainTxHash: txHash,
              blockHeight,
              timestamp
            });
          }
        } catch {
          // Not a JSON event, skip
        }
      }
    }
  }

  return events;
}

/**
 * Store blockchain events in PostgreSQL
 */
async function storeBlockchainEvents(events: BlockchainEvent[]): Promise<void> {
  if (events.length === 0) return;

  const pool = getPool();
  if (!pool) {
    console.warn('Database pool not available, skipping event storage');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const event of events) {
      // Check if already processed (idempotency)
      const existing = await client.query(
        `SELECT 1 FROM blockchain_events WHERE blockchain_tx_hash = $1 AND aggregate_id = $2`,
        [event.blockchainTxHash, event.aggregateId]
      );

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO blockchain_events (event_type, aggregate_id, event_data, blockchain_tx_hash, created_at)
          VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000000000.0))
        `, [
          event.eventType,
          event.aggregateId,
          JSON.stringify(event.eventData),
          event.blockchainTxHash,
          event.timestamp
        ]);

        console.log(`✓ Synced blockchain event: ${event.eventType} (${event.aggregateId})`);

        // Handle specific event types
        if (event.eventType === 'document_registered') {
          // Sync document if registered externally
          await syncExternalDocument(client, event);
        } else if (event.eventType === 'did_registered') {
          // Sync DID if registered externally
          await syncExternalDID(client, event);
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Sync a document that was registered on blockchain but not in PostgreSQL
 */
async function syncExternalDocument(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, event: BlockchainEvent): Promise<void> {
  const docHash = event.eventData.document_hash as string;
  if (!docHash) return;

  // Check if we already have this document
  const existing = await client.query(
    `SELECT 1 FROM documents WHERE document_id = $1 OR blockchain_tx_hash = $2`,
    [docHash, event.blockchainTxHash]
  );

  if (existing.rows.length === 0) {
    // Insert placeholder for externally registered document
    await client.query(`
      INSERT INTO documents (document_id, encrypted_cid, owner_account_id, blockchain_tx_hash, blockchain_synced, created_at)
      VALUES ($1, $2, $3, $4, true, to_timestamp($5 / 1000000000.0))
      ON CONFLICT DO NOTHING
    `, [
      docHash,
      event.eventData.cid || 'external',
      event.eventData.owner || 'external',
      event.blockchainTxHash,
      event.timestamp
    ]);
  }
}

/**
 * Sync a DID that was registered on blockchain but not in local cache
 */
async function syncExternalDID(_client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, event: BlockchainEvent): Promise<void> {
  // DIDs are resolved on-demand from blockchain, but we log the event
  console.log(`DID registered on chain: ${event.eventData.did || event.aggregateId}`);
}

/**
 * Poll NEAR RPC for recent blocks and extract events
 */
export async function pollBlockchainEvents(): Promise<void> {
  const rpcUrl = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
  const contractId = process.env.NEAR_CONTRACT_ID || 'bastion.testnet';

  const provider = new JsonRpcProvider({ url: rpcUrl });

  try {
    // Get current block height
    const status = await provider.status();
    const currentBlock = status.sync_info.latest_block_height;

    // Initialize last processed block if needed
    if (lastProcessedBlock === 0) {
      // Start from recent blocks (last 100 blocks on first run)
      lastProcessedBlock = Math.max(0, currentBlock - 100);
      console.log(`Blockchain event sync starting from block ${lastProcessedBlock}`);
    }

    // Process blocks in batches
    const blocksToProcess = Math.min(10, currentBlock - lastProcessedBlock);

    for (let i = 0; i < blocksToProcess; i++) {
      const blockHeight = lastProcessedBlock + i + 1;

      try {
        // Get block by height
        const block = await provider.block({ blockId: blockHeight });

        // Process each chunk in the block
        for (const chunkHeader of block.chunks) {
          if (chunkHeader.tx_root === '11111111111111111111111111111111') {
            continue; // Empty chunk
          }

          try {
            const chunk = await provider.chunk(chunkHeader.chunk_hash);

            // Check transactions for our contract
            for (const tx of chunk.transactions || []) {
              if (tx.receiver_id === contractId) {
                // Get full transaction outcome
                const outcome = await provider.txStatus(
                  tx.hash,
                  tx.signer_id
                );

                const events = parseReceiptOutcomes(
                  outcome.receipts_outcome,
                  tx.hash,
                  blockHeight,
                  block.header.timestamp
                );

                if (events.length > 0) {
                  await storeBlockchainEvents(events);
                }
              }
            }
          } catch (chunkError: unknown) {
            // Chunk might not be available, skip
            const chunkErrMsg = chunkError instanceof Error ? chunkError.message : String(chunkError);
            if (!chunkErrMsg.includes('UNKNOWN_CHUNK')) {
              console.warn(`Error processing chunk: ${chunkErrMsg}`);
            }
          }
        }
      } catch (blockError: unknown) {
        const blockErrMsg = blockError instanceof Error ? blockError.message : String(blockError);
        if (!blockErrMsg.includes('UNKNOWN_BLOCK')) {
          console.warn(`Error processing block ${blockHeight}: ${blockErrMsg}`);
        }
      }
    }

    lastProcessedBlock = Math.min(currentBlock, lastProcessedBlock + blocksToProcess);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Blockchain event polling error:', errMsg);
    // Don't throw - let the worker retry
  }
}

/**
 * Get sync status
 */
export function getSyncStatus(): { lastBlock: number; running: boolean } {
  return {
    lastBlock: lastProcessedBlock,
    running: lastProcessedBlock > 0
  };
}
