/**
 * KillZoneOverlay
 *
 * Renders the kill zone polygon and arcs of fire on the COP map
 * when an autonomous mission sequence has established them.
 * Polls the active sequence state for kill zone data.
 */

import { useState, useEffect } from 'react';
import { Polygon, Polyline } from 'react-leaflet';

interface KillZoneData {
  polygon: Array<{ lat: number; lng: number }>;
  arcsOfFire: Array<Array<{ lat: number; lng: number }>>;
  overwatch: { lat: number; lng: number };
}

export function KillZoneOverlay() {
  const [killZone, setKillZone] = useState<KillZoneData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/robot/scenarios');
        if (!res.ok || cancelled) return;
        const sequences = await res.json();

        // Find the active autonomous sequence with kill zone data
        const active = (sequences as Array<Record<string, unknown>>).find(
          (s) => s.phase !== 'complete' && s.phase !== 'idle' && (s as Record<string, unknown>).killZone,
        );

        if (active?.killZone && !cancelled) {
          setKillZone(active.killZone as KillZoneData);
        } else if (!cancelled) {
          // Check completed sequences too (kill zone persists after engagement)
          const withKZ = (sequences as Array<Record<string, unknown>>).find(
            (s) => (s as Record<string, unknown>).killZone,
          );
          if (withKZ?.killZone) {
            setKillZone(withKZ.killZone as KillZoneData);
          } else {
            setKillZone(null);
          }
        }
      } catch {
        // Silent
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!killZone) return null;

  const kzPositions: [number, number][] = killZone.polygon.map(
    (p) => [p.lat, p.lng] as [number, number],
  );

  return (
    <>
      {/* Kill zone polygon */}
      <Polygon
        positions={kzPositions}
        pathOptions={{
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '8,4',
        }}
      />

      {/* Arcs of fire from firing positions */}
      {killZone.arcsOfFire.map((arc, i) => {
        const positions: [number, number][] = arc.map(
          (p) => [p.lat, p.lng] as [number, number],
        );
        const isOverwatch = i === killZone.arcsOfFire.length - 1;
        return (
          <Polyline
            key={`arc-${i}`}
            positions={positions}
            pathOptions={{
              color: isOverwatch ? '#3b82f6' : '#f59e0b',
              weight: 2,
              dashArray: '6,3',
              opacity: 0.7,
            }}
          />
        );
      })}
    </>
  );
}
