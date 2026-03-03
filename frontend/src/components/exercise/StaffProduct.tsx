/**
 * StaffProduct
 *
 * Phase 15 Plan 03: Hybrid product editor for exercise staff workspaces.
 *
 * Layout: structured fields on top (schema-driven per PRODUCT_TYPE_REGISTRY),
 * freeform narrative textarea below — scroll down to write.
 *
 * Products start as drafts. Saving updates the draft in-place.
 * Publishing increments the version and fans out cross-staff notifications.
 */

import { useState, useCallback } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { StaffProduct as StaffProductType } from '../../types/exercise';
import { PRODUCT_TYPE_REGISTRY } from '../../types/exercise';
import './StaffProduct.css';

// ─── Unit Table ───────────────────────────────────────────────────────────────

interface UnitRow {
  unitName: string;
  size: string;
  location: string;
  status: string;
}

function emptyUnitRow(): UnitRow {
  return { unitName: '', size: '', location: '', status: '' };
}

function UnitTable({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (rows: UnitRow[]) => void;
}) {
  const rows: UnitRow[] = Array.isArray(value)
    ? (value as UnitRow[])
    : [emptyUnitRow()];

  const updateRow = (idx: number, field: keyof UnitRow, val: string) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r));
    onChange(next);
  };

  const addRow = () => onChange([...rows, emptyUnitRow()]);

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    onChange(next.length === 0 ? [emptyUnitRow()] : next);
  };

  return (
    <div className="sp-unit-table-wrapper">
      <table className="sp-unit-table">
        <thead>
          <tr>
            <th>Unit Name</th>
            <th>Size</th>
            <th>Location</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td>
                <input
                  type="text"
                  className="sp-unit-cell"
                  value={row.unitName}
                  onChange={(e) => updateRow(idx, 'unitName', e.target.value)}
                  placeholder="Unit name"
                />
              </td>
              <td>
                <input
                  type="text"
                  className="sp-unit-cell sp-unit-cell--small"
                  value={row.size}
                  onChange={(e) => updateRow(idx, 'size', e.target.value)}
                  placeholder="BN/BDE"
                />
              </td>
              <td>
                <input
                  type="text"
                  className="sp-unit-cell"
                  value={row.location}
                  onChange={(e) => updateRow(idx, 'location', e.target.value)}
                  placeholder="Grid / place"
                />
              </td>
              <td>
                <input
                  type="text"
                  className="sp-unit-cell sp-unit-cell--small"
                  value={row.status}
                  onChange={(e) => updateRow(idx, 'status', e.target.value)}
                  placeholder="Ready"
                />
              </td>
              <td>
                <button
                  type="button"
                  className="sp-unit-remove"
                  onClick={() => removeRow(idx)}
                  title="Remove row"
                >
                  &times;
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="sp-unit-add" onClick={addRow}>
        + Add Row
      </button>
    </div>
  );
}

// ─── Structured Field Renderer ────────────────────────────────────────────────

interface FieldProps {
  name: string;
  type: string;
  options?: string[];
  value: unknown;
  onChange: (value: unknown) => void;
}

function StructuredField({ name, type, options, value, onChange }: FieldProps) {
  const label = name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  const inputId = `sp-field-${name}`;

  return (
    <div className="sp-field">
      <label className="sp-field-label" htmlFor={inputId}>
        {label}
      </label>

      {type === 'text' && (
        <input
          id={inputId}
          type="text"
          className="sp-field-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'textarea' && (
        <textarea
          id={inputId}
          className="sp-field-textarea"
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'select' && options && (
        <select
          id={inputId}
          className="sp-field-select"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-- select --</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      )}

      {type === 'number' && (
        <input
          id={inputId}
          type="number"
          className="sp-field-input sp-field-input--number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
      )}

      {type === 'date' && (
        <input
          id={inputId}
          type="date"
          className="sp-field-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {type === 'unit_table' && (
        <UnitTable
          value={value}
          onChange={(rows) => onChange(rows)}
        />
      )}
    </div>
  );
}

// ─── New Product Modal ────────────────────────────────────────────────────────

interface NewProductModalProps {
  roleKey: string;
  onSelect: (productType: string, defaultTitle: string) => void;
  onClose: () => void;
  isCreating: boolean;
}

function NewProductModal({ roleKey, onSelect, onClose, isCreating }: NewProductModalProps) {
  const availableTypes = Object.entries(PRODUCT_TYPE_REGISTRY).filter(([, def]) =>
    def.roles.includes(roleKey)
  );

  return (
    <div className="sp-modal-overlay" onClick={onClose}>
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-modal-header">
          <h3 className="sp-modal-title">New Product</h3>
          <button className="sp-modal-close" onClick={onClose} disabled={isCreating}>
            &times;
          </button>
        </div>
        <div className="sp-modal-body">
          {availableTypes.length === 0 ? (
            <p className="sp-modal-empty">No product types available for this role.</p>
          ) : (
            <ul className="sp-type-list">
              {availableTypes.map(([typeKey, def]) => (
                <li key={typeKey}>
                  <button
                    className="sp-type-btn"
                    disabled={isCreating}
                    onClick={() => onSelect(typeKey, def.label)}
                  >
                    <span className="sp-type-btn-label">{def.label}</span>
                    <span className="sp-type-btn-fields">
                      {def.structuredFields.length} structured field
                      {def.structuredFields.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── StaffProduct Editor ──────────────────────────────────────────────────────

interface StaffProductProps {
  product: StaffProductType;
  roleKey: string;
  scenarioId: string;
  onSave: (product: StaffProductType) => void;
  onPublish: (product: StaffProductType) => void;
  onBack: () => void;
}

export function StaffProduct({
  product: initialProduct,
  roleKey: _roleKey,
  scenarioId,
  onSave,
  onPublish,
  onBack,
}: StaffProductProps) {
  const [product, setProduct] = useState<StaffProductType>(initialProduct);
  const [title, setTitle] = useState(initialProduct.title);
  const [structuredData, setStructuredData] = useState<Record<string, unknown>>(
    initialProduct.structured ?? {}
  );
  const [content, setContent] = useState(initialProduct.content ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedBanner, setPublishedBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeDef = PRODUCT_TYPE_REGISTRY[product.productType];

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    markDirty();
  };

  const handleFieldChange = (fieldName: string, val: unknown) => {
    setStructuredData((prev) => ({ ...prev, [fieldName]: val }));
    markDirty();
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    markDirty();
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await exerciseService.updateStaffProduct(scenarioId, product.id, {
        title,
        structured: structuredData,
        content,
      });
      setProduct(updated);
      setIsDirty(false);
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    // Auto-save dirty edits before publishing
    if (isDirty) {
      setIsSaving(true);
      setError(null);
      try {
        await exerciseService.updateStaffProduct(scenarioId, product.id, {
          title,
          structured: structuredData,
          content,
        });
        setIsDirty(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save before publish failed');
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    setIsPublishing(true);
    setError(null);
    try {
      const published = await exerciseService.publishStaffProduct(scenarioId, product.id);
      setProduct(published);
      setPublishedBanner(true);
      setTimeout(() => setPublishedBanner(false), 3000);
      onPublish(published);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="sp-editor">
      {/* ── Header ── */}
      <div className="sp-header">
        <button className="sp-back-btn" onClick={onBack} title="Back to workspace">
          &#8592; Back
        </button>

        <input
          className="sp-title-input"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          aria-label="Product title"
        />

        <div className="sp-header-right">
          {product.version > 1 && (
            <span className="sp-version-badge">v{product.version}</span>
          )}
          <span className={`sp-status-badge sp-status-badge--${product.status}`}>
            {product.status}
          </span>

          <button
            className="sp-btn sp-btn--secondary"
            onClick={handleSave}
            disabled={!isDirty || isSaving || isPublishing}
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            className="sp-btn sp-btn--primary"
            onClick={handlePublish}
            disabled={isSaving || isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* ── Published banner ── */}
      {publishedBanner && (
        <div className="sp-published-banner">
          Published — cross-staff notifications sent.
        </div>
      )}

      {error && <div className="sp-error">{error}</div>}

      {/* ── Structured Fields section ── */}
      {typeDef && typeDef.structuredFields.length > 0 && (
        <section className="sp-section sp-section--structured">
          <h3 className="sp-section-title">
            {typeDef.label}
            <span className="sp-section-subtitle">Structured Data</span>
          </h3>
          <div className="sp-fields-grid">
            {typeDef.structuredFields.map((field) => (
              <StructuredField
                key={field.name}
                name={field.name}
                type={field.type}
                options={field.options}
                value={structuredData[field.name]}
                onChange={(val) => handleFieldChange(field.name, val)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Divider ── */}
      <div className="sp-divider">
        <span className="sp-divider-label">Narrative Analysis</span>
      </div>

      {/* ── Freeform content section ── */}
      <section className="sp-section sp-section--narrative">
        <textarea
          className="sp-narrative-textarea"
          placeholder="Write your narrative analysis here. Supports Markdown."
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
        />
      </section>
    </div>
  );
}

// ─── RoleDashboard integration helpers ───────────────────────────────────────

export { NewProductModal };
export type { StaffProductProps };
