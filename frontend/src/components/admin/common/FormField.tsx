/**
 * FormField Component
 *
 * Reusable form field wrapper with label, error display, and required indicator.
 * Styled to match BASTION command center aesthetic.
 */

import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
  hint?: string;
}

export function FormField({
  label,
  error,
  children,
  required,
  className = '',
  hint,
}: FormFieldProps) {
  return (
    <div className={`form-field ${className} ${error ? 'form-field--error' : ''}`}>
      <label className="form-label">
        {label}
        {required && <span className="form-required">*</span>}
      </label>
      {children}
      {hint && !error && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
