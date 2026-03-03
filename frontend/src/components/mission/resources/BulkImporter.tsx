/**
 * Bulk Importer Component
 *
 * CSV bulk import for resources using react-csv-importer.
 * Column mapping, preview, progress indicator, and success/error summary.
 */

import { useState } from 'react';
import { Importer, ImporterField } from 'react-csv-importer';
import 'react-csv-importer/dist/index.css';
import { resourceService, type BulkImportRow } from '../../../lib/resource-service.js';

interface BulkImporterProps {
  missionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImporter({ missionId, onClose, onSuccess }: BulkImporterProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; errors: Array<{ row: number; error: string }> } | null>(null);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !importing) {
      onClose();
    }
  };

  const handleImport = async (rows: BulkImportRow[]) => {
    setImporting(true);

    try {
      // Validate rows
      const validRows: BulkImportRow[] = [];
      const errors: Array<{ row: number; error: string }> = [];

      rows.forEach((row, index) => {
        // Validate required fields
        if (!row.name || !row.category) {
          errors.push({
            row: index + 1,
            error: 'Missing required fields: name and category',
          });
          return;
        }

        // Validate status if provided
        if (row.status && !['FMC', 'PMC', 'NMC'].includes(row.status)) {
          errors.push({
            row: index + 1,
            error: 'Invalid status. Must be FMC, PMC, or NMC',
          });
          return;
        }

        validRows.push(row);
      });

      // Import valid rows
      const importResult = await resourceService.bulkImport(missionId, validRows);

      // Combine validation errors with import errors
      const allErrors = [...errors, ...importResult.errors];

      setResult({
        created: importResult.created,
        failed: errors.length + importResult.failed,
        errors: allErrors,
      });
    } catch (err) {
      console.error('Import failed:', err);
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleComplete = () => {
    onSuccess();
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content bulk-importer-modal">
        <div className="modal-header">
          <h2>Bulk Import Resources</h2>
          <button onClick={onClose} className="modal-close" type="button" disabled={importing}>
            ✕
          </button>
        </div>

        <div className="bulk-importer-content">
          {!result ? (
            <>
              <div className="import-instructions">
                <h3>CSV Import Instructions</h3>
                <ul>
                  <li>Upload a CSV file with resource data</li>
                  <li>Required columns: <strong>name</strong>, <strong>category</strong></li>
                  <li>Optional columns: <strong>serialNumber</strong>, <strong>status</strong> (FMC/PMC/NMC), <strong>location</strong></li>
                  <li>First row should contain column headers</li>
                  <li>You'll be able to map your columns to the required fields</li>
                </ul>
              </div>

              <div className="csv-importer-wrapper">
                <Importer<BulkImportRow>
                  dataHandler={async (rows) => {
                    await handleImport(rows as unknown as BulkImportRow[]);
                  }}
                  defaultNoHeader={false}
                  restartable={false}
                >
                  <ImporterField name="name" label="Resource Name" />
                  <ImporterField name="category" label="Category" />
                  <ImporterField name="serialNumber" label="Serial Number" optional />
                  <ImporterField name="status" label="Status (FMC/PMC/NMC)" optional />
                  <ImporterField name="location" label="Location" optional />
                </Importer>
              </div>
            </>
          ) : (
            <div className="import-results">
              <h3>Import Results</h3>

              <div className="result-summary">
                <div className="result-stat result-stat--success">
                  <div className="stat-value">{result.created}</div>
                  <div className="stat-label">Resources Created</div>
                </div>

                {result.failed > 0 && (
                  <div className="result-stat result-stat--error">
                    <div className="stat-value">{result.failed}</div>
                    <div className="stat-label">Failed</div>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="import-errors">
                  <h4>Errors</h4>
                  <div className="error-list">
                    {result.errors.map((err, index) => (
                      <div key={index} className="error-item">
                        <strong>Row {err.row}:</strong> {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button onClick={handleComplete} className="btn btn-primary">
                  Done
                </button>
              </div>
            </div>
          )}

          {importing && (
            <div className="import-progress">
              <div className="spinner"></div>
              <p>Importing resources...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
