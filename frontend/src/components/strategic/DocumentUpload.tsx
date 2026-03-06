/**
 * DocumentUpload Component
 *
 * Document upload interface with drag-and-drop support.
 * Allows commanders to upload strategic documents (PDF, DOCX).
 */

import { useState, useCallback, useRef } from 'react';
import type { StrategicDocument } from '../../lib/types/strategic.js';
import { DocumentLevel, Classification } from '../../lib/types/strategic.js';
import { strategicService, formatFileSize } from '../../lib/strategic-service.js';
import './DocumentUpload.css';

interface DocumentUploadProps {
  onUploadComplete?: (doc: StrategicDocument) => void;
  problemSetId?: string;
}

export function DocumentUpload({ onUploadComplete, problemSetId }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<typeof DocumentLevel[keyof typeof DocumentLevel]>('OTHER');
  const [classification, setClassification] = useState<typeof Classification[keyof typeof Classification]>('UNCLASSIFIED');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    setSuccess(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload a PDF or DOCX file.');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.');
      return;
    }

    setFile(selectedFile);
    // Auto-fill title from filename if empty
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(false);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !title) {
      setError('Please select a file and enter a title.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const doc = await strategicService.uploadDocument(file, title, level, classification, problemSetId);
      setSuccess(true);
      setFile(null);
      setTitle('');
      setLevel('OTHER');
      setClassification('UNCLASSIFIED');
      onUploadComplete?.(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDropzoneClick = () => {
    if (!file) {
      fileInputRef.current?.click();
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="document-upload">
      <h3 className="upload-title">Upload Strategic Document</h3>

      <div
        className={`upload-dropzone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleDropzoneClick}
      >
        {file ? (
          <div className="file-preview">
            <div className="file-icon">
              {file.type === 'application/pdf' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              )}
            </div>
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatFileSize(file.size)}</span>
            </div>
            <button className="clear-file" onClick={handleClearFile} type="button" title="Remove file">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="drop-prompt">
            <div className="drop-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="drop-text">Drop PDF or DOCX file here</span>
            <span className="drop-hint">or click to browse</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFileChange}
              className="file-input"
            />
          </div>
        )}
      </div>

      <div className="upload-form">
        <div className="form-group">
          <label htmlFor="doc-title">Document Title</label>
          <input
            id="doc-title"
            type="text"
            placeholder="Enter document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="doc-level">Document Level</label>
            <select
              id="doc-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof DocumentLevel[keyof typeof DocumentLevel])}
              disabled={uploading}
            >
              <option value="NSS">National Security Strategy</option>
              <option value="NDS">National Defense Strategy</option>
              <option value="NMS">National Military Strategy</option>
              <option value="GEF">Guidance for Employment of the Force</option>
              <option value="JSCP">Joint Strategic Capabilities Plan</option>
              <option value="CAMPAIGN_PLAN">Campaign Plan</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="doc-classification">Classification</label>
            <select
              id="doc-classification"
              value={classification}
              onChange={(e) => setClassification(e.target.value as typeof Classification[keyof typeof Classification])}
              disabled={uploading}
            >
              <option value="UNCLASSIFIED">UNCLASSIFIED</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
              <option value="SECRET">SECRET</option>
              <option value="TOP_SECRET">TOP SECRET</option>
            </select>
          </div>
        </div>

        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!file || !title || uploading}
        >
          {uploading ? (
            <>
              <span className="spinner" />
              Uploading...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Document
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="upload-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {success && (
        <div className="upload-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22,4 12,14.01 9,11.01" />
          </svg>
          Document uploaded successfully!
        </div>
      )}
    </div>
  );
}
