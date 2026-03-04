import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import ms from 'milsymbol';

/**
 * MilSymbolMarker
 *
 * Phase 4.4 Plan 08: Renders military symbols on map using MIL-STD-2525D
 */

interface MilSymbolMarkerProps {
  position: [number, number];
  sidc: string;
  name: string;
  onClick?: () => void;
  uniqueDesignation?: string;
  higherFormation?: string;
}

/**
 * Creates a Leaflet icon from a MIL-STD-2525D SIDC code
 */
// eslint-disable-next-line react-refresh/only-export-components
export function createMilSymbolIcon(
  sidc: string,
  options?: {
    uniqueDesignation?: string;
    higherFormation?: string;
    size?: number;
  }
): L.DivIcon {
  // Create symbol using milsymbol
  const symbol = new ms.Symbol(sidc, {
    size: options?.size || 30,
    uniqueDesignation: options?.uniqueDesignation,
    higherFormation: options?.higherFormation,
  });

  // Get SVG string
  const svg = symbol.asSVG();

  return L.divIcon({
    className: 'milsymbol-marker',
    html: svg,
    iconSize: [symbol.getSize().width, symbol.getSize().height],
    iconAnchor: [symbol.getSize().width / 2, symbol.getSize().height / 2],
  });
}

/**
 * Leaflet marker component with military symbol icon
 */
export function MilSymbolMarker({
  position,
  sidc,
  name,
  onClick,
  uniqueDesignation,
  higherFormation,
}: MilSymbolMarkerProps) {
  const icon = createMilSymbolIcon(sidc, {
    uniqueDesignation,
    higherFormation,
  });

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="unit-popup">
          <h4>{name}</h4>
          {uniqueDesignation && (
            <p className="designation">{uniqueDesignation}</p>
          )}
          {higherFormation && (
            <p className="higher-formation">Higher: {higherFormation}</p>
          )}
          <p className="sidc-code">SIDC: {sidc}</p>
        </div>
      </Popup>
    </Marker>
  );
}
