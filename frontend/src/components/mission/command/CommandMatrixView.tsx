/**
 * Command Matrix View Component
 *
 * Grid visualization of command relationships using @tanstack/react-table.
 * Rows: subordinate units, Columns: superior units, Cells: relationship type.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';
import type { CommandUnit, CommandMatrix, MatrixCell, RelationshipType } from '../../../lib/types/command';
import { commandService, getRelationshipTypeName, getRelationshipTypeColor } from '../../../lib/command-service';
import { RelationshipEditor } from './RelationshipEditor';
import './CommandMatrixView.css';

interface CommandMatrixViewProps {
  missionId: string;
}

interface MatrixRow {
  subordinateUnit: CommandUnit;
  relationships: Record<string, MatrixCell>;
}

export function CommandMatrixView({ missionId }: CommandMatrixViewProps) {
  const [matrixData, setMatrixData] = useState<CommandMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    superiorUnitId: string;
    subordinateUnitId: string;
    existingRelationship?: MatrixCell;
  } | null>(null);

  useEffect(() => {
    loadMatrix();
  }, [missionId]);

  async function loadMatrix() {
    try {
      setLoading(true);
      setError(null);
      const matrix = await commandService.getMatrix(missionId);
      setMatrixData(matrix);
    } catch (err) {
      console.error('Failed to load matrix:', err);
      setError(err instanceof Error ? err.message : 'Failed to load matrix');
    } finally {
      setLoading(false);
    }
  }

  function handleCellClick(superiorUnitId: string, subordinateUnitId: string, cell: MatrixCell) {
    setEditingCell({
      superiorUnitId,
      subordinateUnitId,
      existingRelationship: cell,
    });
    setEditorOpen(true);
  }

  function handleEditorClose() {
    setEditorOpen(false);
    setEditingCell(null);
    loadMatrix(); // Reload matrix after editing
  }

  const columns = useMemo<ColumnDef<MatrixRow>[]>(() => {
    if (!matrixData) return [];

    const columnHelper = createColumnHelper<MatrixRow>();

    const cols: ColumnDef<MatrixRow>[] = [
      columnHelper.accessor('subordinateUnit', {
        header: 'Subordinate Unit',
        cell: (info) => (
          <div className="matrix-unit-cell">
            <div className="matrix-unit-name">{info.getValue().name}</div>
            <div className="matrix-unit-echelon">{info.getValue().echelon}</div>
          </div>
        ),
        size: 200,
      }),
    ];

    // Add column for each superior unit
    matrixData.units.forEach((unit) => {
      cols.push(
        columnHelper.display({
          id: unit.id,
          header: () => (
            <div className="matrix-header-cell">
              <div className="matrix-unit-name">{unit.name}</div>
              <div className="matrix-unit-echelon">{unit.echelon}</div>
            </div>
          ),
          cell: (info) => {
            const row = info.row.original;
            const cell = row.relationships[unit.id] || {};
            const hasRelationship = !!cell.relationshipType;

            return (
              <div
                className={`matrix-relationship-cell ${hasRelationship ? 'has-relationship' : 'empty'}`}
                onClick={() => handleCellClick(unit.id, row.subordinateUnit.id, cell)}
                title={hasRelationship ? getRelationshipTypeName(cell.relationshipType!) : 'Click to add relationship'}
              >
                {hasRelationship ? (
                  <div className={`matrix-relationship-badge ${getRelationshipTypeColor(cell.relationshipType!)}`}>
                    {cell.relationshipType}
                  </div>
                ) : (
                  <div className="matrix-relationship-empty">+</div>
                )}
              </div>
            );
          },
          size: 120,
        })
      );
    });

    return cols;
  }, [matrixData]);

  const tableData = useMemo<MatrixRow[]>(() => {
    if (!matrixData) return [];

    return matrixData.units.map((unit) => ({
      subordinateUnit: unit,
      relationships: matrixData.matrix[unit.id] || {},
    }));
  }, [matrixData]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div className="matrix-loading">
        <div className="spinner" />
        <p>Loading command matrix...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matrix-error">
        <p>Error: {error}</p>
        <button onClick={loadMatrix} className="btn-retry">
          Retry
        </button>
      </div>
    );
  }

  if (!matrixData || matrixData.units.length === 0) {
    return (
      <div className="matrix-empty">
        <p>No units defined.</p>
        <p className="matrix-hint">Add units to view the command matrix.</p>
      </div>
    );
  }

  return (
    <div className="command-matrix-container">
      <div className="matrix-table-wrapper">
        <table className="matrix-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matrix-legend">
        <div className="matrix-legend-title">Relationship Types:</div>
        <div className="matrix-legend-items">
          <div className="matrix-legend-item">
            <div className="matrix-relationship-badge relationship-cocom">COCOM</div>
            <span>Combatant Command</span>
          </div>
          <div className="matrix-legend-item">
            <div className="matrix-relationship-badge relationship-opcon">OPCON</div>
            <span>Operational Control</span>
          </div>
          <div className="matrix-legend-item">
            <div className="matrix-relationship-badge relationship-tacon">TACON</div>
            <span>Tactical Control</span>
          </div>
          <div className="matrix-legend-item">
            <div className="matrix-relationship-badge relationship-adcon">ADCON</div>
            <span>Administrative Control</span>
          </div>
          <div className="matrix-legend-item">
            <div className="matrix-relationship-badge relationship-support">DS/GS/GSR/R</div>
            <span>Support Relationships</span>
          </div>
        </div>
      </div>

      {editorOpen && editingCell && (
        <RelationshipEditor
          missionId={missionId}
          superiorUnitId={editingCell.superiorUnitId}
          subordinateUnitId={editingCell.subordinateUnitId}
          existingRelationship={editingCell.existingRelationship}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}
