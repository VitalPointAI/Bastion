/**
 * RoleDashboard
 *
 * Phase 15 Plan 02: Per-role dashboard overview in the exercise staff workspace.
 *
 * On mount (and when roleKey changes): fetches staff products for the role
 * and the unread notification count. Displays:
 *   1. Role header with doctrinal focus
 *   2. Outstanding Actions (draft count, unread notifications badge)
 *   3. Product Summary card grid (product cards with status badges)
 *   4. Quick Actions row
 *
 * Special: Commander role also shows a Staff Overview section with all
 * published products across all roles.
 */

import { useState, useEffect, useCallback } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { StaffProduct } from '../../types/exercise';
import { STAFF_ROLE_CONFIG } from '../../types/exercise';
import './RoleDashboard.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RoleDashboardProps {
  roleKey: string;
  scenarioId: string;
  exercisePhase: string;
  perspective: string;
  isControllerView: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ─── Product Card ──────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: StaffProduct;
  onClick?: () => void;
}

function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <div
      className={`role-product-card ${product.status === 'published' ? 'role-product-card--published' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      title={`${product.title} — click to open editor (coming in Plan 15-03)`}
    >
      <div className="role-product-card-header">
        <span className="role-product-type">{product.productType.replace(/_/g, ' ')}</span>
        <span className={`role-product-status role-product-status--${product.status}`}>
          {product.status}
        </span>
      </div>
      <div className="role-product-title">{product.title}</div>
      <div className="role-product-meta">
        <span>v{product.version}</span>
        <span className="role-product-time">{formatRelativeTime(product.updatedAt)}</span>
      </div>
    </div>
  );
}

// ─── RoleDashboard ─────────────────────────────────────────────────────────────

export function RoleDashboard({
  roleKey,
  scenarioId,
  exercisePhase,
  isControllerView,
}: RoleDashboardProps) {
  const [products, setProducts] = useState<StaffProduct[]>([]);
  const [allPublished, setAllPublished] = useState<StaffProduct[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const roleConfig = STAFF_ROLE_CONFIG[roleKey];
  const isCommander = roleKey === 'commander';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [roleProducts, count] = await Promise.all([
        exerciseService.getStaffProducts(scenarioId, roleKey),
        exerciseService.getUnreadNotificationCount(scenarioId, roleKey),
      ]);
      setProducts(roleProducts);
      setUnreadCount(count);

      // Commander: also load all published products across all roles
      if (isCommander) {
        const all = await exerciseService.getStaffProducts(scenarioId);
        setAllPublished(all.filter((p) => p.status === 'published' && p.roleKey !== 'commander'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace data');
    } finally {
      setIsLoading(false);
    }
  }, [scenarioId, roleKey, isCommander]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleImportStrategicDirection = async () => {
    setIsImporting(true);
    try {
      const product = await exerciseService.importStrategicDirection(scenarioId);
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === product.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = product;
          return next;
        }
        return [product, ...prev];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const draftCount = products.filter((p) => p.status === 'draft').length;
  const publishedCount = products.filter((p) => p.status === 'published').length;

  if (isLoading) {
    return (
      <div className="role-dashboard role-dashboard--loading">
        <p>Loading {roleConfig?.label ?? roleKey} workspace...</p>
      </div>
    );
  }

  return (
    <div className="role-dashboard">
      {/* ── Role header ── */}
      <div className="role-dashboard-header">
        <div className="role-dashboard-title">
          <h2 className="role-dashboard-name">{roleConfig?.label ?? roleKey}</h2>
          {roleConfig && (
            <p className="role-dashboard-focus">{roleConfig.doctrinalFocus}</p>
          )}
        </div>
        <div className="role-dashboard-phase">
          <span className="role-phase-label">{exercisePhase}</span>
          {isControllerView && (
            <span className="role-controller-badge">Controller View</span>
          )}
        </div>
      </div>

      {error && <div className="role-dashboard-error">{error}</div>}

      {/* ── Outstanding Actions ── */}
      <section className="role-section">
        <h3 className="role-section-title">Outstanding Actions</h3>
        <div className="role-actions-row">
          {unreadCount > 0 ? (
            <div className="role-action-badge role-action-badge--alert">
              <span className="role-action-count">{unreadCount}</span>
              <span className="role-action-label">
                {unreadCount === 1 ? 'update from other staff sections' : 'updates from other staff sections'}
              </span>
            </div>
          ) : (
            <div className="role-action-badge role-action-badge--clear">
              <span className="role-action-label">No pending notifications</span>
            </div>
          )}
          {draftCount > 0 && (
            <div className="role-action-badge role-action-badge--draft">
              <span className="role-action-count">{draftCount}</span>
              <span className="role-action-label">
                {draftCount === 1 ? 'product in draft' : 'products in draft'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── Product Summary ── */}
      <section className="role-section">
        <div className="role-section-header">
          <h3 className="role-section-title">
            Products
            {publishedCount > 0 && (
              <span className="role-product-counts">
                {publishedCount} published
                {draftCount > 0 && `, ${draftCount} draft`}
              </span>
            )}
          </h3>
        </div>

        {products.length === 0 ? (
          <div className="role-products-empty">
            <p>No products yet.</p>
            <p>Use "New Product" below to create the first {roleConfig?.label ?? roleKey} product.</p>
          </div>
        ) : (
          <div className="role-products-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                // Product editor wired in Plan 15-03
                onClick={() => undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Quick Actions ── */}
      <section className="role-section role-section--actions">
        <h3 className="role-section-title">Quick Actions</h3>
        <div className="role-quick-actions">
          <button
            className="role-action-btn"
            title="View notifications — wired in Plan 15-04"
            disabled
          >
            View Notifications
            {unreadCount > 0 && (
              <span className="role-action-btn-badge">{unreadCount}</span>
            )}
          </button>

          {isCommander && (
            <button
              className="role-action-btn role-action-btn--primary"
              onClick={handleImportStrategicDirection}
              disabled={isImporting}
              title="Import approved objectives and latest intent from the Design tab"
            >
              {isImporting ? 'Importing...' : 'Import Strategic Direction'}
            </button>
          )}

          <button
            className="role-action-btn"
            title="New product — editor wired in Plan 15-03"
            disabled
          >
            + New Product
          </button>
        </div>
      </section>

      {/* ── Commander: Staff Overview ── */}
      {isCommander && allPublished.length > 0 && (
        <section className="role-section role-section--staff-overview">
          <h3 className="role-section-title">
            Staff Overview
            <span className="role-product-counts">{allPublished.length} published across all sections</span>
          </h3>
          <div className="role-products-grid">
            {allPublished.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => undefined}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
