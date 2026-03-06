/**
 * ExerciseBanner
 *
 * Sticky amber banner displayed at the top of the viewport when
 * the application is in training mode. Provides clear visual
 * indication that actions affect exercise data, not live data.
 */

const bannerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 9999,
  background: '#D97706',
  color: '#000',
  fontWeight: 700,
  textAlign: 'center',
  padding: '4px 0',
  letterSpacing: '0.15em',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  userSelect: 'none',
};

export function ExerciseBanner() {
  return (
    <div style={bannerStyle} role="status" aria-live="polite">
      EXERCISE - EXERCISE - EXERCISE - EXERCISE - EXERCISE - EXERCISE - EXERCISE - EXERCISE - EXERCISE
    </div>
  );
}
