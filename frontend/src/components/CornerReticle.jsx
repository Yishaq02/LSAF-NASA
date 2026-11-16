import React from 'react';

/**
 * Optical Corner Reticle (SpaceX Crew Dragon / AstroUXDS HUD overlay)
 * Renders fine 8px x 8px tactical corner brackets at the 4 module corners.
 */
export default function CornerReticle({ color = 'border-cyan-400/70' }) {
  return (
    <>
      <span className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${color} pointer-events-none z-20`} />
      <span className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${color} pointer-events-none z-20`} />
      <span className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${color} pointer-events-none z-20`} />
      <span className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${color} pointer-events-none z-20`} />
    </>
  );
}
