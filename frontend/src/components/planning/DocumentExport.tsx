/**
 * DocumentExport Component
 *
 * Phase 05 Plan 13: Document export interface for OPLAN/OPORD and briefings
 * Supports DOCX, PDF, PPTX exports and planning product previews
 */

import { useState } from 'react';
import {
  getOPORDDocxUrl,
  getOPORDPdfUrl,
  getBriefingUrl,
  getSyncMatrix,
  getDST,
  getCCIR,
} from '../../lib/planning-service';
import './DocumentExport.css';

interface DocumentExportProps {
  planId: string;
  planName: string;
}

export function DocumentExport({ planId, planName }: DocumentExportProps) {
  const [syncMatrix, setSyncMatrix] = useState<Record<string, unknown> | null>(null);
  const [dst, setDst] = useState<Record<string, unknown> | null>(null);
  const [ccir, setCcir] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadSyncMatrix = async () => {
    setLoading('sync-matrix');
    try {
      const data = await getSyncMatrix(planId);
      setSyncMatrix(data as Record<string, unknown>);
    } finally {
      setLoading(null);
    }
  };

  const loadDST = async () => {
    setLoading('dst');
    try {
      const data = await getDST(planId);
      setDst(data as Record<string, unknown>);
    } finally {
      setLoading(null);
    }
  };

  const loadCCIR = async () => {
    setLoading('ccir');
    try {
      const data = await getCCIR(planId);
      setCcir(data as Record<string, unknown>);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="document-export">
      <h4>Document Export</h4>

      <div className="export-section">
        <h5>Operation Orders</h5>
        <div className="export-buttons">
          <button
            className="export-btn docx"
            onClick={() =>
              handleDownload(
                getOPORDDocxUrl(planId),
                `${planName}_OPORD.docx`
              )
            }
          >
            <span className="icon">W</span>
            OPORD (DOCX)
          </button>
          <button
            className="export-btn pdf"
            onClick={() =>
              handleDownload(getOPORDPdfUrl(planId), `${planName}_OPORD.pdf`)
            }
          >
            <span className="icon">P</span>
            OPORD (PDF)
          </button>
        </div>
      </div>

      <div className="export-section">
        <h5>Briefings</h5>
        <div className="export-buttons">
          <button
            className="export-btn pptx"
            onClick={() =>
              handleDownload(
                getBriefingUrl(planId, 'commander'),
                `${planName}_Commander_Brief.pptx`
              )
            }
          >
            <span className="icon">S</span>
            Commander Brief
          </button>
          <button
            className="export-btn pptx"
            onClick={() =>
              handleDownload(
                getBriefingUrl(planId, 'staff'),
                `${planName}_Staff_Brief.pptx`
              )
            }
          >
            <span className="icon">S</span>
            Staff Brief
          </button>
          <button
            className="export-btn pptx"
            onClick={() =>
              handleDownload(
                getBriefingUrl(planId, 'rehearsal'),
                `${planName}_Rehearsal_Brief.pptx`
              )
            }
          >
            <span className="icon">S</span>
            Rehearsal Brief
          </button>
        </div>
      </div>

      <div className="export-section">
        <h5>Planning Products</h5>
        <div className="export-buttons vertical">
          <button
            className="export-btn data"
            onClick={loadSyncMatrix}
            disabled={loading === 'sync-matrix'}
          >
            {loading === 'sync-matrix' ? 'Loading...' : 'Synchronization Matrix'}
          </button>
          <button
            className="export-btn data"
            onClick={loadDST}
            disabled={loading === 'dst'}
          >
            {loading === 'dst' ? 'Loading...' : 'Decision Support Template'}
          </button>
          <button
            className="export-btn data"
            onClick={loadCCIR}
            disabled={loading === 'ccir'}
          >
            {loading === 'ccir' ? 'Loading...' : 'CCIR (PIR/FFIR/EEFI)'}
          </button>
        </div>
      </div>

      {syncMatrix && (
        <div className="data-preview">
          <h5>Synchronization Matrix</h5>
          <pre>{JSON.stringify(syncMatrix, null, 2)}</pre>
          <button onClick={() => setSyncMatrix(null)}>Close</button>
        </div>
      )}

      {dst && (
        <div className="data-preview">
          <h5>Decision Support Template</h5>
          <pre>{JSON.stringify(dst, null, 2)}</pre>
          <button onClick={() => setDst(null)}>Close</button>
        </div>
      )}

      {ccir && (
        <div className="data-preview">
          <h5>CCIR</h5>
          <pre>{JSON.stringify(ccir, null, 2)}</pre>
          <button onClick={() => setCcir(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
