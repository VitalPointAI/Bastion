/**
 * CoGNodeEditor
 *
 * Phase 25 Plan 03: Popover editor for CoG tree nodes.
 * Allows editing label and description, shows type as colored badge.
 */

import { useState } from 'react';
import type { CoGNode } from '../../lib/design-service.ts';

const TYPE_LABELS: Record<CoGNode['type'], string> = {
  'cog': 'Center of Gravity',
  'critical-capability': 'Critical Capability',
  'critical-requirement': 'Critical Requirement',
  'critical-vulnerability': 'Critical Vulnerability',
};

const TYPE_ABBREV: Record<CoGNode['type'], string> = {
  'cog': 'CG',
  'critical-capability': 'CC',
  'critical-requirement': 'CR',
  'critical-vulnerability': 'CV',
};

const TYPE_COLORS: Record<CoGNode['type'], string> = {
  'cog': '#ef4444',
  'critical-capability': '#f59e0b',
  'critical-requirement': '#3b82f6',
  'critical-vulnerability': '#10b981',
};

interface CoGNodeEditorProps {
  node: CoGNode;
  onSave: (updates: { label: string; description: string }) => void;
  onClose: () => void;
  onDelete: () => void;
  isRoot?: boolean;
  style?: React.CSSProperties;
}

export function CoGNodeEditor({ node, onSave, onClose, onDelete, isRoot, style }: CoGNodeEditorProps) {
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onSave({ label: label.trim() || node.label, description: description.trim() });
  };

  return (
    <div
      className="absolute z-50 w-72 bg-gray-800 border border-gray-600 shadow-xl rounded-lg p-4"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: TYPE_COLORS[node.type], color: '#fff' }}
          >
            {TYPE_ABBREV[node.type]}
          </span>
          <span className="text-sm text-gray-300">{TYPE_LABELS[node.type]}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-lg leading-none"
        >
          x
        </button>
      </div>

      {/* Label */}
      <div className="mb-3">
        <label className="block text-xs text-gray-400 mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          maxLength={80}
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {!isRoot && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          )}
          {!isRoot && confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Are you sure?</span>
              <button
                onClick={onDelete}
                className="text-xs text-red-300 font-bold hover:text-red-200"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                No
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
