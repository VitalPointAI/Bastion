/**
 * RoleGatedSection
 *
 * Phase 33 Plan 05: Wrapper component that controls edit access based on
 * staff role. All roles can VIEW content, but only allowed roles can edit.
 * Non-owning roles see a read-only view with visual distinction.
 */

import type { ReactNode } from 'react';

export interface RoleGatedSectionProps {
  allowedRoles: string[];
  currentRole: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function RoleGatedSection({
  allowedRoles,
  currentRole,
  title,
  description,
  children,
}: RoleGatedSectionProps) {
  const canEdit = allowedRoles.includes(currentRole);

  return (
    <div
      style={{
        borderLeft: `3px solid ${canEdit ? '#3b82f6' : '#6b7280'}`,
        paddingLeft: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#e5e7eb' }}>
            {title}
          </h3>
          {!canEdit && (
            <span
              style={{
                fontSize: '0.7rem',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(107, 114, 128, 0.3)',
                color: '#9ca3af',
                fontWeight: 500,
              }}
            >
              read-only
            </span>
          )}
        </div>
        {description && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
            {description}
          </p>
        )}
      </div>

      {/* Content area: read-only overlay for non-owning roles */}
      <div
        style={{
          ...(canEdit
            ? {}
            : {
                pointerEvents: 'none' as const,
                opacity: 0.75,
                userSelect: 'none' as const,
              }),
        }}
      >
        {children}
      </div>
    </div>
  );
}
