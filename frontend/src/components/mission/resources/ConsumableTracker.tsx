/**
 * Consumable Tracker Component
 *
 * Tracks consumable levels with progress bars and low stock alerts.
 * Color coding: green (>50%), yellow (20-50%), red (<20%).
 */

import { useState } from 'react';
import { resourceService, type Consumable } from '../../../lib/resource-service.js';

interface ConsumableTrackerProps {
  problemSetId: string;
  consumables: Consumable[];
  onUpdate: () => void;
}

export function ConsumableTracker({ problemSetId: _problemSetId, consumables, onUpdate }: ConsumableTrackerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Calculate stock level percentage
  const getStockPercentage = (consumable: Consumable): number => {
    if (consumable.minimumLevel === 0) return 100;
    return (consumable.currentLevel / consumable.minimumLevel) * 100;
  };

  // Get color class based on percentage
  const getColorClass = (percentage: number): string => {
    if (percentage > 50) return 'green';
    if (percentage >= 20) return 'yellow';
    return 'red';
  };

  // Get low stock items (below minimum)
  const lowStockItems = consumables.filter((c) => c.currentLevel < c.minimumLevel);

  // Start editing
  const handleEdit = (consumable: Consumable) => {
    setEditingId(consumable.id);
    setEditValue(consumable.currentLevel.toString());
  };

  // Cancel editing
  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  // Save edited level
  const handleSave = async (id: string) => {
    const newLevel = parseFloat(editValue);

    if (isNaN(newLevel) || newLevel < 0) {
      alert('Please enter a valid positive number');
      return;
    }

    try {
      await resourceService.updateLevel(id, newLevel);
      setEditingId(null);
      setEditValue('');
      onUpdate();
    } catch (err) {
      console.error('Failed to update level:', err);
      alert('Failed to update level');
    }
  };

  return (
    <div className="consumable-tracker">
      {/* Low Stock Alert Section */}
      {lowStockItems.length > 0 && (
        <div className="low-stock-alert">
          <div className="alert-header">
            <span className="alert-icon">⚠️</span>
            <h3>Low Stock Alert</h3>
            <span className="alert-count">{lowStockItems.length} items below minimum</span>
          </div>
          <div className="alert-items">
            {lowStockItems.map((item) => (
              <div key={item.id} className="alert-item">
                <strong>{item.name}</strong>
                <span>
                  {item.currentLevel} {item.unit} (min: {item.minimumLevel})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consumables List */}
      <div className="consumables-list">
        <h3>All Consumables</h3>

        {consumables.length === 0 ? (
          <div className="empty-state">
            No consumables tracked yet. Click "Add Resource" to add consumables.
          </div>
        ) : (
          <div className="consumables-grid">
            {consumables.map((consumable) => {
              const percentage = getStockPercentage(consumable);
              const colorClass = getColorClass(percentage);
              const isEditing = editingId === consumable.id;

              return (
                <div key={consumable.id} className="consumable-card">
                  <div className="consumable-header">
                    <h4>{consumable.name}</h4>
                    <span className="consumable-category">{consumable.category}</span>
                  </div>

                  <div className="consumable-body">
                    <div className="level-display">
                      {isEditing ? (
                        <div className="level-edit">
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            min="0"
                            step="any"
                            autoFocus
                          />
                          <span>{consumable.unit}</span>
                        </div>
                      ) : (
                        <div className="level-value">
                          <span className="current-level">
                            {consumable.currentLevel} {consumable.unit}
                          </span>
                          <span className="minimum-level">
                            min: {consumable.minimumLevel} {consumable.unit}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="progress-bar-container">
                      <div className={`progress-bar progress-bar--${colorClass}`}>
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <span className="progress-label">{percentage.toFixed(0)}%</span>
                    </div>

                    {consumable.location && (
                      <div className="consumable-location">
                        <span className="location-icon">📍</span>
                        {consumable.location}
                      </div>
                    )}
                  </div>

                  <div className="consumable-actions">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSave(consumable.id)}
                          className="btn btn-sm btn-primary"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="btn btn-sm btn-secondary"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEdit(consumable)}
                        className="btn btn-sm btn-secondary"
                      >
                        Update Level
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
