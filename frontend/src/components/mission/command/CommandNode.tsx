/**
 * Command Node Component
 *
 * Custom tree node for command hierarchy visualization.
 * Displays unit name, milsymbol icon, and relationship badge.
 */

import { useEffect, useRef } from 'react';
import type { CommandUnit, RelationshipType } from '../../../lib/types/command';
import { getRelationshipTypeName, getRelationshipTypeColor } from '../../../lib/command-service';
// @ts-ignore - milsymbol doesn't have types
import ms from 'milsymbol';

interface CommandNodeProps {
  unit: CommandUnit;
  relationshipType?: RelationshipType;
  multiHatted?: boolean;
}

export function CommandNode({ unit, relationshipType, multiHatted }: CommandNodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && unit.sidc) {
      try {
        // Create milsymbol instance
        const symbol = new ms.Symbol(unit.sidc, {
          size: 30,
        });

        // Get canvas context and draw
        const ctx = canvasRef.current.getContext('2d');
        if (ctx && symbol.asCanvas) {
          const symbolCanvas = symbol.asCanvas();

          // Set canvas size to match symbol
          canvasRef.current.width = symbolCanvas.width;
          canvasRef.current.height = symbolCanvas.height;

          // Draw symbol
          ctx.drawImage(symbolCanvas, 0, 0);
        }
      } catch (error) {
        console.error('Failed to render milsymbol:', error);
      }
    }
  }, [unit.sidc]);

  return (
    <div className="command-node">
      <div className="command-node-header">
        <canvas ref={canvasRef} className="command-node-symbol" />
        {multiHatted && (
          <span className="command-node-multi-hat" title="Multi-hatted unit">
            ★
          </span>
        )}
      </div>

      <div className="command-node-body">
        <div className="command-node-name">{unit.name}</div>
        <div className="command-node-echelon">{unit.echelon}</div>

        {relationshipType && (
          <div className={`command-node-relationship ${getRelationshipTypeColor(relationshipType)}`}>
            {getRelationshipTypeName(relationshipType)}
          </div>
        )}
      </div>
    </div>
  );
}
