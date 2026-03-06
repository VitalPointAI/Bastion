/**
 * ActorCategoryBadge Component
 *
 * Color-coded pill badge for actor categories.
 * Follows MIDLIFE_METADATA badge styling pattern.
 */

interface ActorCategoryBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

/**
 * Convert hex color to rgba with opacity.
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function ActorCategoryBadge({ name, color, size = 'md' }: ActorCategoryBadgeProps) {
  const isSm = size === 'sm';

  return (
    <span
      className="actor-category-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '0.3rem' : '0.4rem',
        padding: isSm ? '0.2rem 0.5rem' : '0.3rem 0.65rem',
        fontSize: isSm ? '0.7rem' : '0.8rem',
        fontWeight: 600,
        color: color,
        background: hexToRgba(color, 0.15),
        borderRadius: '999px',
        letterSpacing: '0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: isSm ? '6px' : '8px',
          height: isSm ? '6px' : '8px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {name}
    </span>
  );
}
