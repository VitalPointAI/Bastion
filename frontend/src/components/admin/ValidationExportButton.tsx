/**
 * ValidationExportButton Component
 *
 * Phase 31 Plan 05: Dropdown button for exporting validation data as CSV
 * or PDF report. Supports optional agent-specific and date-range filtering.
 */

import { useState, useRef, useEffect } from 'react';
import { validationService } from '../../lib/validation-service';

interface ValidationExportButtonProps {
  agentId?: string;
  dateRange?: { from: string; to: string };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ValidationExportButton({
  agentId,
  dateRange,
}: ValidationExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportCSV = async () => {
    setExporting('csv');
    try {
      const blob = await validationService.exportCSV(
        agentId,
        dateRange?.from,
        dateRange?.to,
      );
      const filename = agentId
        ? `validation-${agentId}.csv`
        : 'validation-results.csv';
      triggerDownload(blob, filename);
    } catch (err) {
      console.error('[ValidationExportButton] CSV export failed:', err);
    } finally {
      setExporting(null);
      setOpen(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const blob = await validationService.exportPDF(
        agentId,
        dateRange?.from,
        dateRange?.to,
      );
      const filename = agentId
        ? `validation-${agentId}-report.pdf`
        : 'validation-report.pdf';
      triggerDownload(blob, filename);
    } catch (err) {
      console.error('[ValidationExportButton] PDF export failed:', err);
    } finally {
      setExporting(null);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={exporting !== null}
        className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 rounded transition-colors flex items-center gap-2"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-200" />
            Exporting...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 min-w-[140px]">
          <button
            onClick={handleExportCSV}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors"
          >
            CSV Data
          </button>
          <button
            onClick={handleExportPDF}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/50 transition-colors border-t border-gray-700/50"
          >
            PDF Report
          </button>
        </div>
      )}
    </div>
  );
}
