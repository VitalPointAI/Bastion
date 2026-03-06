/**
 * ContainerSelector Component
 *
 * Multi-select dropdown for assigning documents to strategic containers.
 * Containers are grouped by actor category with inline creation support.
 * Optionally shows AI-suggested containers after document extraction.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CategoryGroup, StrategicContainer } from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';

export interface ContainerSuggestion {
  containerName: string;
  containerId?: string;
  confidence: number;
  reasoning: string;
  newContainerName?: string;
  suggestedCategory?: string;
}

interface ContainerSelectorProps {
  environmentId: string;
  selectedContainerIds: string[];
  onChange: (ids: string[]) => void;
  suggestedContainerIds?: string[];
  onContainerCreated?: () => void;
  documentId?: string;
  extractionComplete?: boolean;
  disabled?: boolean;
}

export function ContainerSelector({
  environmentId,
  selectedContainerIds,
  onChange,
  suggestedContainerIds: externalSuggestions,
  onContainerCreated,
  documentId,
  extractionComplete,
  disabled = false,
}: ContainerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ContainerSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestedIds, setSuggestedIds] = useState<string[]>([]);
  const [newContainerSuggestions, setNewContainerSuggestions] = useState<ContainerSuggestion[]>([]);
  const [creatingInCategory, setCreatingInCategory] = useState<string | null>(null);
  const [newContainerName, setNewContainerName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newContainerInputRef = useRef<HTMLInputElement>(null);

  // Fetch container groups
  const fetchGroups = useCallback(async () => {
    if (!environmentId) return;
    setLoading(true);
    try {
      const data = await strategicService.getContainersGrouped(environmentId);
      setGroups(data);
    } catch (err) {
      console.error('Failed to fetch container groups:', err);
    } finally {
      setLoading(false);
    }
  }, [environmentId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Fetch AI suggestions when document extraction is complete
  useEffect(() => {
    if (!documentId || !extractionComplete || !environmentId) return;

    let cancelled = false;
    setSuggestionsLoading(true);

    strategicService.suggestContainers(documentId, environmentId)
      .then((result) => {
        if (cancelled) return;
        setSuggestions(result);

        // Extract suggested container IDs and auto-select high-confidence ones
        const ids: string[] = [];
        const newSuggestions: ContainerSuggestion[] = [];

        for (const s of result) {
          if (s.containerId) {
            ids.push(s.containerId);
            // Auto-check containers with confidence > 0.7
            if (s.confidence > 0.7 && !selectedContainerIds.includes(s.containerId)) {
              onChange([...selectedContainerIds, s.containerId]);
            }
          } else if (s.newContainerName) {
            newSuggestions.push(s);
          }
        }

        setSuggestedIds(ids);
        setNewContainerSuggestions(newSuggestions);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to get container suggestions:', err);
        }
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, extractionComplete, environmentId]);

  // Merge external suggestions
  useEffect(() => {
    if (externalSuggestions?.length) {
      setSuggestedIds((prev) => {
        const merged = new Set([...prev, ...externalSuggestions]);
        return Array.from(merged);
      });
    }
  }, [externalSuggestions]);

  // Click outside closes dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setCreatingInCategory(null);
        setNewContainerName('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus new container input when creating
  useEffect(() => {
    if (creatingInCategory && newContainerInputRef.current) {
      newContainerInputRef.current.focus();
    }
  }, [creatingInCategory]);

  const handleToggle = (containerId: string) => {
    if (selectedContainerIds.includes(containerId)) {
      onChange(selectedContainerIds.filter((id) => id !== containerId));
    } else {
      onChange([...selectedContainerIds, containerId]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setCreatingInCategory(null);
    }
  };

  const handleCreateContainer = async (categoryId: string) => {
    if (!newContainerName.trim()) return;
    setCreateError(null);
    try {
      const result = await strategicService.createContainer(environmentId, {
        categoryId,
        name: newContainerName.trim(),
      });
      // Auto-select newly created container
      onChange([...selectedContainerIds, result.id]);
      setNewContainerName('');
      setCreatingInCategory(null);
      // Refresh groups
      await fetchGroups();
      onContainerCreated?.();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create container');
    }
  };

  const isSuggested = (containerId: string): boolean => {
    return suggestedIds.includes(containerId);
  };

  const getSuggestionConfidence = (containerId: string): number | undefined => {
    const s = suggestions.find((s) => s.containerId === containerId);
    return s?.confidence;
  };

  // Get display label for button
  const getButtonLabel = (): string => {
    const count = selectedContainerIds.length;
    if (count === 0) return 'No containers (Unorganized)';
    if (count === 1) {
      // Find container name
      for (const group of groups) {
        const container = group.containers.find((c) => c.id === selectedContainerIds[0]);
        if (container) return container.name;
      }
      return '1 container selected';
    }
    return `${count} containers selected`;
  };

  if (!environmentId) {
    return (
      <div className="container-selector container-selector--disabled">
        <button className="container-selector__button" disabled>
          No environment available
        </button>
      </div>
    );
  }

  return (
    <div className="container-selector" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        className={`container-selector__button ${isOpen ? 'container-selector__button--open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="container-selector__label">{getButtonLabel()}</span>
        <svg
          className={`container-selector__chevron ${isOpen ? 'container-selector__chevron--open' : ''}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M6 8L1 3h10z" />
        </svg>
      </button>

      {isOpen && (
        <div className="container-selector__panel" role="listbox" aria-multiselectable="true">
          {loading ? (
            <div className="container-selector__loading">Loading containers...</div>
          ) : groups.length === 0 ? (
            <div className="container-selector__empty">No categories found</div>
          ) : (
            <>
              {suggestionsLoading && (
                <div className="container-selector__ai-loading">
                  <span className="container-selector__ai-spinner" />
                  AI analyzing...
                </div>
              )}

              {groups.map((group) => (
                <div key={group.category.id} className="container-selector__group">
                  <div className="container-selector__category-header">
                    <span
                      className="container-selector__category-badge"
                      style={{ backgroundColor: group.category.color }}
                    />
                    <span className="container-selector__category-name">
                      {group.category.name}
                    </span>
                  </div>

                  {/* New container suggestions for this category */}
                  {newContainerSuggestions
                    .filter((s) => s.suggestedCategory?.toLowerCase() === group.category.name.toLowerCase())
                    .map((s, i) => (
                      <button
                        key={`suggestion-${i}`}
                        className="container-selector__new-suggestion"
                        onClick={async () => {
                          try {
                            const result = await strategicService.createContainer(environmentId, {
                              categoryId: group.category.id,
                              name: s.newContainerName!,
                            });
                            onChange([...selectedContainerIds, result.id]);
                            setNewContainerSuggestions((prev) => prev.filter((_, idx) => idx !== i));
                            await fetchGroups();
                            onContainerCreated?.();
                          } catch (err) {
                            console.error('Failed to create suggested container:', err);
                          }
                        }}
                        type="button"
                      >
                        <span className="container-selector__star" title="AI suggested">*</span>
                        <span>Create: {s.newContainerName}</span>
                      </button>
                    ))}

                  {group.containers.map((container) => {
                    const checked = selectedContainerIds.includes(container.id);
                    const suggested = isSuggested(container.id);
                    const confidence = getSuggestionConfidence(container.id);

                    return (
                      <label
                        key={container.id}
                        className={`container-selector__item ${suggested ? 'container-selector__item--suggested' : ''}`}
                        role="option"
                        aria-selected={checked}
                        title={suggested ? `AI suggested (${Math.round((confidence || 0) * 100)}% confidence)` : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle(container.id)}
                          className="container-selector__checkbox"
                          tabIndex={0}
                        />
                        <span className="container-selector__item-name">
                          {container.name}
                        </span>
                        {suggested && (
                          <span className="container-selector__star" title="AI suggested">*</span>
                        )}
                        <span className="container-selector__item-count">
                          ({container.documentCount})
                        </span>
                      </label>
                    );
                  })}

                  {/* Inline create form */}
                  {creatingInCategory === group.category.id ? (
                    <div className="container-selector__create-form">
                      <input
                        ref={newContainerInputRef}
                        type="text"
                        placeholder="Container name"
                        value={newContainerName}
                        onChange={(e) => setNewContainerName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateContainer(group.category.id);
                          } else if (e.key === 'Escape') {
                            setCreatingInCategory(null);
                            setNewContainerName('');
                          }
                        }}
                        className="container-selector__create-input"
                      />
                      <button
                        className="container-selector__create-submit"
                        onClick={() => handleCreateContainer(group.category.id)}
                        disabled={!newContainerName.trim()}
                        type="button"
                      >
                        Add
                      </button>
                      {createError && (
                        <span className="container-selector__create-error">{createError}</span>
                      )}
                    </div>
                  ) : (
                    <button
                      className="container-selector__add-link"
                      onClick={() => {
                        setCreatingInCategory(group.category.id);
                        setNewContainerName('');
                        setCreateError(null);
                      }}
                      type="button"
                    >
                      + New container
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
