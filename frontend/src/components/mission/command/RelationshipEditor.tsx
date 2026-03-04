/**
 * Relationship Editor Component
 *
 * Modal form for creating and editing command relationships.
 * Validates against cycles and provides date range options.
 */

import { useState, useEffect } from 'react';
import type { RelationshipType, MatrixCell, CommandUnit } from '../../../lib/types/command';
import { commandService, getRelationshipTypeName } from '../../../lib/command-service';
import './RelationshipEditor.css';

interface RelationshipEditorProps {
  missionId: string;
  superiorUnitId: string;
  subordinateUnitId: string;
  existingRelationship?: MatrixCell;
  onClose: () => void;
}

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'COCOM',
  'OPCON',
  'TACON',
  'ADCON',
  'DS',
  'GS',
  'GSR',
  'R',
];

export function RelationshipEditor({
  missionId,
  superiorUnitId,
  subordinateUnitId,
  existingRelationship,
  onClose,
}: RelationshipEditorProps) {
  const [units, setUnits] = useState<CommandUnit[]>([]);
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(
    existingRelationship?.relationshipType || 'OPCON'
  );
  const [effectiveFrom, setEffectiveFrom] = useState(existingRelationship?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState(existingRelationship?.effectiveTo || '');
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!existingRelationship?.relationshipId;

  useEffect(() => {
    async function loadUnits() {
      try {
        const unitList = await commandService.getUnits(missionId);
        setUnits(unitList);
      } catch (err) {
        console.error('Failed to load units:', err);
      }
    }
    loadUnits();
  }, [missionId]);

  async function handleSave() {
    try {
      setLoading(true);
      setError(null);
      setValidationWarning(null);

      // Validate hierarchy before saving
      const validation = await commandService.validateHierarchy(missionId);
      if (!validation.valid && validation.cycles && validation.cycles.length > 0) {
        setValidationWarning(
          `Warning: This relationship may create a cycle in the command hierarchy. Cycles detected: ${validation.cycles.length}`
        );
        // Don't prevent saving, just warn
      }

      // Create the relationship
      await commandService.createRelationship({
        missionId,
        superiorUnitId,
        subordinateUnitId,
        relationshipType,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || undefined,
      });

      onClose();
    } catch (err) {
      console.error('Failed to save relationship:', err);
      setError(err instanceof Error ? err.message : 'Failed to save relationship');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEditing || !existingRelationship?.relationshipId) return;

    if (!confirm('Are you sure you want to delete this relationship?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await commandService.deleteRelationship(existingRelationship.relationshipId);
      onClose();
    } catch (err) {
      console.error('Failed to delete relationship:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete relationship');
    } finally {
      setLoading(false);
    }
  }

  const superiorUnit = units.find((u) => u.id === superiorUnitId);
  const subordinateUnit = units.find((u) => u.id === subordinateUnitId);

  return (
    <div className="relationship-editor-overlay" onClick={onClose}>
      <div className="relationship-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="relationship-editor-header">
          <h3>{isEditing ? 'Edit Relationship' : 'Create Relationship'}</h3>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="relationship-editor-body">
          {error && (
            <div className="relationship-editor-error">
              {error}
            </div>
          )}

          {validationWarning && (
            <div className="relationship-editor-warning">
              {validationWarning}
            </div>
          )}

          <div className="relationship-editor-units">
            <div className="relationship-unit-info">
              <label>Superior Unit:</label>
              <div className="unit-display">
                {superiorUnit ? (
                  <>
                    <div className="unit-name">{superiorUnit.name}</div>
                    <div className="unit-echelon">{superiorUnit.echelon}</div>
                  </>
                ) : (
                  <div className="unit-loading">Loading...</div>
                )}
              </div>
            </div>

            <div className="relationship-arrow">→</div>

            <div className="relationship-unit-info">
              <label>Subordinate Unit:</label>
              <div className="unit-display">
                {subordinateUnit ? (
                  <>
                    <div className="unit-name">{subordinateUnit.name}</div>
                    <div className="unit-echelon">{subordinateUnit.echelon}</div>
                  </>
                ) : (
                  <div className="unit-loading">Loading...</div>
                )}
              </div>
            </div>
          </div>

          <div className="relationship-editor-form">
            <div className="form-field">
              <label htmlFor="relationshipType">Relationship Type *</label>
              <select
                id="relationshipType"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
                disabled={loading}
              >
                {RELATIONSHIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type} - {getRelationshipTypeName(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="effectiveFrom">Effective From (Optional)</label>
              <input
                type="datetime-local"
                id="effectiveFrom"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="effectiveTo">Effective To (Optional)</label>
              <input
                type="datetime-local"
                id="effectiveTo"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="relationship-editor-footer">
          {isEditing && (
            <button
              className="btn-delete"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </button>
          )}

          <div className="footer-actions">
            <button
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={loading || !superiorUnit || !subordinateUnit}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
