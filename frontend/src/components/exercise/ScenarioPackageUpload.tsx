/**
 * ScenarioPackageUpload
 *
 * Phase 14 Plan 06: Multi-file upload with drag-and-drop,
 * client-side tag inference preview, and extraction trigger.
 *
 * Features:
 * - Drag-and-drop zone + folder input (webkitdirectory) + standard multi-file input
 * - Pre-upload preview table: Filename | Team | Phase | Type | Confidence
 * - Manual tag override via dropdowns in each row
 * - Upload button with progress feedback
 * - Post-upload document list with extraction status
 *
 * Tag inference replicates the server-side heuristics from
 * backend/src/exercise/package-parser.ts for instant client-side preview.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { ExerciseScenario, ScenarioDocument, InferredFileTags, ExerciseDocumentType } from '../../types/exercise';
import './ScenarioPackageUpload.css';

// ─── Client-Side Tag Inference ─────────────────────────────────────────────────

// Mirrors backend/src/exercise/package-parser.ts heuristics

type TagTeam = 'blue' | 'red' | 'controller' | 'unknown';

const TEAM_HEURISTICS: Array<{ pattern: RegExp; team: Exclude<TagTeam, 'unknown'> }> = [
  { pattern: /blue[\s_-]?team|team[\s_-]?blue/i, team: 'blue' },
  { pattern: /red[\s_-]?team|team[\s_-]?red/i, team: 'red' },
  { pattern: /scenario[\s_-]?phases?|exercise[\s_-]?control|excon/i, team: 'controller' },
];

const PHASE_HEURISTICS: Array<{ pattern: RegExp; phase: string }> = [
  { pattern: /competition|phase[\s_-]?1\b/i, phase: 'Competition' },
  { pattern: /crisis|phase[\s_-]?2\b/i, phase: 'Crisis' },
  { pattern: /day[\s_-]?4|conflict[\s_-]?day[\s_-]?4|phase[\s_-]?3\b/i, phase: 'Conflict Day 4' },
  { pattern: /day[\s_-]?10|conflict[\s_-]?day[\s_-]?10|phase[\s_-]?4\b/i, phase: 'Conflict Day 10' },
  { pattern: /day[\s_-]?22|conflict[\s_-]?day[\s_-]?22|phase[\s_-]?5\b/i, phase: 'Conflict Day 22' },
  { pattern: /negotiat|phase[\s_-]?6\b/i, phase: 'Negotiation' },
  { pattern: /overall|phase[\s_-]?3[\s_-]?-?[\s_-]?5/i, phase: 'Conflict Day 4' },
];

const TYPE_HEURISTICS: Array<{ pattern: RegExp; type: ExerciseDocumentType }> = [
  { pattern: /sitrep|situation[\s_-]?report|situation[\s_-]?update/i, type: 'SITREP' },
  { pattern: /alertord|alert[\s_-]?order/i, type: 'ALERTORD' },
  { pattern: /frago|fragmentary/i, type: 'FRAGO' },
  { pattern: /oob|order[\s_-]?of[\s_-]?battle/i, type: 'OOB' },
  { pattern: /campaign[\s_-]?plan/i, type: 'CAMPAIGN_PLAN' },
  { pattern: /policy[\s_-]?sheet|country[\s_-]?policy/i, type: 'COUNTRY_POLICY' },
  { pattern: /planning[\s_-]?map|hex/i, type: 'PLANNING_MAP' },
  { pattern: /directive|learning[\s_-]?event/i, type: 'DIRECTIVE' },
  { pattern: /conop|concept[\s_-]?of[\s_-]?operations/i, type: 'CAMPAIGN_PLAN' },
];

function inferTagsFromPath(relativePath: string): InferredFileTags {
  let matchCount = 0;

  let team: TagTeam = 'unknown';
  for (const h of TEAM_HEURISTICS) {
    if (h.pattern.test(relativePath)) {
      team = h.team;
      matchCount++;
      break;
    }
  }

  let exercisePhase = 'General';
  for (const h of PHASE_HEURISTICS) {
    if (h.pattern.test(relativePath)) {
      exercisePhase = h.phase;
      matchCount++;
      break;
    }
  }

  let documentType: ExerciseDocumentType = 'OTHER';
  for (const h of TYPE_HEURISTICS) {
    if (h.pattern.test(relativePath)) {
      documentType = h.type;
      matchCount++;
      break;
    }
  }

  const confidence = matchCount === 3 ? 1.0 : matchCount >= 1 ? 0.7 : 0.5;

  return { team, exercisePhase, documentType, confidence };
}

// ─── Tag Override State ────────────────────────────────────────────────────────

interface FileEntry {
  file: File;
  tags: InferredFileTags;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ALL_TEAMS: Array<{ value: TagTeam; label: string }> = [
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'controller', label: 'Controller' },
  { value: 'unknown', label: 'Unknown' },
];

const ALL_TYPES: ExerciseDocumentType[] = [
  'ALERTORD', 'SITREP', 'CAMPAIGN_PLAN', 'FRAGO', 'OOB',
  'COUNTRY_POLICY', 'PLANNING_MAP', 'DIRECTIVE', 'OTHER',
];

const DEFAULT_PHASES = [
  'Competition', 'Crisis', 'Conflict Day 4', 'Conflict Day 10', 'Conflict Day 22', 'Negotiation', 'General',
];

// ─── ScenarioPackageUpload ─────────────────────────────────────────────────────

interface ScenarioPackageUploadProps {
  scenario: ExerciseScenario | null;
  onUploadComplete?: () => void;
  onDocumentClick?: (doc: ScenarioDocument) => void;
}

export function ScenarioPackageUpload({ scenario, onUploadComplete, onDocumentClick }: ScenarioPackageUploadProps) {
  // ── File selection state ────────────────────────────────────────────────────
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // ── Upload state ────────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<ScenarioDocument[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing documents + poll for extraction progress ──────────────────
  const docsRef = useRef(uploadedDocs);
  docsRef.current = uploadedDocs;

  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;

    const fetchDocs = () => {
      exerciseService.getDocuments(scenario.id).then((docs) => {
        if (!cancelled) setUploadedDocs(docs);
      }).catch(() => { /* non-fatal */ });
    };

    fetchDocs();

    // Poll every 5s while any doc is still pending extraction
    const interval = setInterval(() => {
      if (cancelled) return;
      const hasPending = docsRef.current.some((d) => d.extractionConfidence === 0);
      if (hasPending) fetchDocs();
    }, 5000);

    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario?.id]);

  // ── Document edit/delete handlers ─────────────────────────────────────────
  const handleDocUpdate = async (
    docId: string,
    updates: { team?: string; exercisePhase?: string; documentType?: string }
  ) => {
    try {
      const updated = await exerciseService.updateDocument(docId, updates);
      setUploadedDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch {
      /* non-fatal */
    }
  };

  const handleDocDelete = async (docId: string) => {
    try {
      await exerciseService.deleteDocument(docId);
      setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      /* non-fatal */
    }
  };

  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const handleRetryExtraction = async (docId: string) => {
    setRetryingIds((prev) => new Set(prev).add(docId));
    try {
      await exerciseService.retryExtraction(docId);
      // Reset local state to show pending while extraction runs
      setUploadedDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, extractionConfidence: 0, extractedData: {} }
            : d
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      setUploadError(msg);
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  // ── File processing ─────────────────────────────────────────────────────────

  const processFiles = useCallback((newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map((file) => {
      const path = file.webkitRelativePath || file.name;
      return { file, tags: inferTagsFromPath(path) };
    });
    setFileEntries((prev) => {
      // Deduplicate by name+size
      const existing = new Set(prev.map((e) => `${e.file.name}:${e.file.size}`));
      const newUnique = entries.filter((e) => !existing.has(`${e.file.name}:${e.file.size}`));
      return [...prev, ...newUnique];
    });
    setUploadError(null);
    setUploadSuccess(null);
  }, []);

  // ── Drag-and-drop handlers ──────────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) processFiles(dropped);
  };

  const onFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) processFiles(selected);
    e.target.value = '';
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) processFiles(selected);
    e.target.value = '';
  };

  // ── Tag override handlers ───────────────────────────────────────────────────

  const updateTeam = (index: number, team: TagTeam) => {
    setFileEntries((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, tags: { ...entry.tags, team } } : entry
      )
    );
  };

  const updatePhase = (index: number, exercisePhase: string) => {
    setFileEntries((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, tags: { ...entry.tags, exercisePhase } } : entry
      )
    );
  };

  const updateType = (index: number, documentType: ExerciseDocumentType) => {
    setFileEntries((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, tags: { ...entry.tags, documentType } } : entry
      )
    );
  };

  const removeFile = (index: number) => {
    setFileEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFileEntries([]);
    setUploadError(null);
    setUploadSuccess(null);
  };

  // ── Upload handler ─────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!scenario || fileEntries.length === 0) return;
    setIsUploading(true);
    setUploadProgress(null);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const files = fileEntries.map((e) => e.file);
      const tags = fileEntries.map((e) => ({
        team: e.tags.team === 'unknown' ? 'controller' : e.tags.team,
        exercisePhase: e.tags.exercisePhase,
        documentType: e.tags.documentType,
      }));
      const docs = await exerciseService.uploadPackage(
        scenario.id,
        files,
        tags,
        (loaded, total) => setUploadProgress({ loaded, total }),
      );
      setUploadedDocs((prev) => [...docs, ...prev]);
      setFileEntries([]);
      setUploadProgress(null);
      const failed = files.length - docs.length;
      if (failed > 0) {
        setUploadSuccess(
          `${docs.length} of ${files.length} uploaded. ${failed} file(s) failed (check console). LLM extraction running in background.`
        );
      } else {
        setUploadSuccess(
          `${docs.length} document${docs.length !== 1 ? 's' : ''} uploaded. LLM extraction running in background.`
        );
      }
      onUploadComplete?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalSize = fileEntries.reduce((sum, e) => sum + e.file.size, 0);
  const scenarioPhases = scenario?.exercisePhases ?? DEFAULT_PHASES;

  if (!scenario) {
    return (
      <div className="package-upload">
        <div className="upload-no-scenario">
          <h3>No Scenario Selected</h3>
          <p>Create or select a scenario above to upload a package.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="package-upload">
      <div className="upload-section-header">
        <h2 className="upload-title">Scenario Package Upload</h2>
        <p className="upload-subtitle">
          Upload scenario package files for <strong>{scenario.name}</strong>.
          Tags are inferred from file paths — review and adjust before uploading.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`upload-dropzone ${isDragging ? 'drag-active' : ''} ${fileEntries.length > 0 ? 'has-files' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="drop-prompt">
          <div className="drop-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
            </svg>
          </div>
          {fileEntries.length > 0 ? (
            <span className="drop-text">
              {fileEntries.length} file{fileEntries.length !== 1 ? 's' : ''} selected ({formatSize(totalSize)}) — drop more or select below
            </span>
          ) : (
            <span className="drop-text">Drop files or folder here</span>
          )}
          <span className="drop-hint">Supports folder upload (Chrome/Edge) and individual file selection</span>
        </div>
      </div>

      {/* Input buttons */}
      <div className="upload-inputs">
        <button
          className="input-btn"
          onClick={() => folderInputRef.current?.click()}
          disabled={isUploading}
        >
          Select Folder
        </button>
        <button
          className="input-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          Select Files
        </button>
        {fileEntries.length > 0 && (
          <button className="input-btn input-btn--clear" onClick={clearAll} disabled={isUploading}>
            Clear All
          </button>
        )}

        {/* Hidden inputs */}
        <input
          ref={folderInputRef}
          type="file"
          style={{ display: 'none' }}
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          multiple
          onChange={onFolderInputChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          multiple
          onChange={onFileInputChange}
        />
      </div>

      {/* Tag preview table */}
      {fileEntries.length > 0 && (
        <div className="tag-preview">
          <div className="tag-preview-header">
            <span className="tag-preview-count">
              {fileEntries.length} file{fileEntries.length !== 1 ? 's' : ''} — review inferred tags before uploading
            </span>
          </div>
          <div className="tag-table-wrapper">
            <table className="tag-table">
              <thead>
                <tr>
                  <th className="col-file">Filename</th>
                  <th className="col-team">Team</th>
                  <th className="col-phase">Phase</th>
                  <th className="col-type">Type</th>
                  <th className="col-conf">Confidence</th>
                  <th className="col-remove"></th>
                </tr>
              </thead>
              <tbody>
                {fileEntries.map((entry, idx) => {
                  const path = entry.file.webkitRelativePath || entry.file.name;
                  const displayName = path.length > 60 ? `...${path.slice(-57)}` : path;
                  const conf = entry.tags.confidence;
                  const confClass =
                    conf >= 0.9 ? 'conf--high' : conf >= 0.6 ? 'conf--med' : 'conf--low';

                  return (
                    <tr key={`${entry.file.name}-${entry.file.size}-${idx}`}>
                      <td className="col-file" title={path}>
                        <span className="filename">{displayName}</span>
                        <span className="filesize">{formatSize(entry.file.size)}</span>
                      </td>
                      <td className="col-team">
                        <select
                          className={`tag-select team-select team-select--${entry.tags.team}`}
                          value={entry.tags.team}
                          onChange={(e) => updateTeam(idx, e.target.value as TagTeam)}
                        >
                          {ALL_TEAMS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="col-phase">
                        <select
                          className="tag-select"
                          value={entry.tags.exercisePhase}
                          onChange={(e) => updatePhase(idx, e.target.value)}
                        >
                          {scenarioPhases.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                          {!scenarioPhases.includes(entry.tags.exercisePhase) && (
                            <option value={entry.tags.exercisePhase}>{entry.tags.exercisePhase}</option>
                          )}
                          <option value="General">General</option>
                        </select>
                      </td>
                      <td className="col-type">
                        <select
                          className="tag-select"
                          value={entry.tags.documentType}
                          onChange={(e) => updateType(idx, e.target.value as ExerciseDocumentType)}
                        >
                          {ALL_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`col-conf ${confClass}`}>
                        {Math.round(conf * 100)}%
                      </td>
                      <td className="col-remove">
                        <button
                          className="remove-btn"
                          onClick={() => removeFile(idx)}
                          title="Remove file"
                          aria-label={`Remove ${entry.file.name}`}
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Upload action */}
          <div className="upload-action">
            <div className="upload-summary">
              {fileEntries.length} file{fileEntries.length !== 1 ? 's' : ''} &bull; {formatSize(totalSize)}
            </div>
            {isUploading && uploadProgress && (
              <div className="upload-progress">
                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="upload-progress-text">
                  {formatSize(uploadProgress.loaded)} / {formatSize(uploadProgress.total)}
                  {' '}({Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%)
                </span>
              </div>
            )}
            <button
              className="upload-button"
              onClick={handleUpload}
              disabled={isUploading || fileEntries.length === 0}
            >
              {isUploading ? (
                <>
                  <span className="spinner" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
                  </svg>
                  Upload & Extract ({fileEntries.length} file{fileEntries.length !== 1 ? 's' : ''})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error / Success messages */}
      {uploadError && (
        <div className="upload-message upload-message--error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {uploadError}
        </div>
      )}
      {uploadSuccess && (
        <div className="upload-message upload-message--success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {uploadSuccess}
        </div>
      )}

      {/* Uploaded documents list */}
      {uploadedDocs.length > 0 && (
        <div className="uploaded-docs">
          <div className="uploaded-docs-header">
            <h3 className="uploaded-docs-title">Uploaded Documents ({uploadedDocs.length})</h3>
            <button
              className="input-btn input-btn--clear"
              onClick={async () => {
                if (!confirm(`Delete all ${uploadedDocs.length} documents?`)) return;
                try {
                  await Promise.all(uploadedDocs.map((d) => exerciseService.deleteDocument(d.id)));
                  setUploadedDocs([]);
                } catch { /* non-fatal */ }
              }}
            >
              Delete All
            </button>
          </div>
          <div className="uploaded-docs-table-wrapper">
            <table className="uploaded-docs-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Team</th>
                  <th>Phase</th>
                  <th>Type</th>
                  <th>Extraction</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {uploadedDocs.map((doc) => {
                  const conf = doc.extractionConfidence;
                  const dataKeys = Object.keys(doc.extractedData ?? {});
                  const hasData = dataKeys.length > 0;
                  const isEmpty = hasData && (doc.extractedData as Record<string, unknown>)?.summary === 'Document was empty or could not be parsed.';
                  const statusClass = isEmpty ? 'failed' : hasData ? 'extracted' : 'pending';
                  const statusLabel = isEmpty
                    ? 'Parse failed'
                    : hasData
                      ? `Extracted (${Math.round(conf * 100)}%)`
                      : 'Pending';
                  const displayName = doc.filename.length > 50
                    ? `...${doc.filename.slice(-47)}`
                    : doc.filename;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => onDocumentClick?.(doc)}
                      style={onDocumentClick ? { cursor: 'pointer' } : undefined}
                    >
                      <td className="doc-col-filename" title={doc.filename}>{displayName}</td>
                      <td>
                        <select
                          className={`tag-select team-select team-select--${doc.team}`}
                          value={doc.team}
                          onChange={(e) => handleDocUpdate(doc.id, { team: e.target.value })}
                        >
                          {ALL_TEAMS.filter((t) => t.value !== 'unknown').map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="tag-select"
                          value={doc.exercisePhase}
                          onChange={(e) => handleDocUpdate(doc.id, { exercisePhase: e.target.value })}
                        >
                          {scenarioPhases.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                          {!scenarioPhases.includes(doc.exercisePhase) && (
                            <option value={doc.exercisePhase}>{doc.exercisePhase}</option>
                          )}
                        </select>
                      </td>
                      <td>
                        <select
                          className="tag-select"
                          value={doc.documentType}
                          onChange={(e) => handleDocUpdate(doc.id, { documentType: e.target.value })}
                        >
                          {ALL_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`doc-status doc-status--${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="doc-col-actions">
                        <button
                          className="retry-btn"
                          onClick={() => handleRetryExtraction(doc.id)}
                          disabled={retryingIds.has(doc.id) || statusClass === 'pending'}
                          title={statusClass === 'pending' ? 'Extraction in progress' : 'Retry extraction'}
                          aria-label={`Retry extraction for ${doc.filename}`}
                        >
                          {retryingIds.has(doc.id) ? '...' : '\u21BB'}
                        </button>
                        <button
                          className="remove-btn"
                          onClick={() => handleDocDelete(doc.id)}
                          title="Delete document"
                          aria-label={`Delete ${doc.filename}`}
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
