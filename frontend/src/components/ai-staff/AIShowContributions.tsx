/**
 * AIShowContributions -- Toggle for AI vs human content distinction
 *
 * Small toggle button that highlights all elements with data-ai-contributed="true"
 * by setting a CSS class on the tab content container. This is the "audit mode"
 * per CONTEXT.md -- clean workspace by default, highlighted when needed.
 */

import { useState, useCallback, useEffect } from 'react';

/** CSS class applied to the container when contributions are highlighted */
const HIGHLIGHT_CLASS = 'ai-contributions-highlighted';

/**
 * Global CSS rule injected once:
 * .ai-contributions-highlighted [data-ai-contributed="true"] {
 *   outline: 2px dashed var(--accent-blue, #3b82f6);
 *   outline-offset: 2px;
 * }
 */
let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = `.${HIGHLIGHT_CLASS} [data-ai-contributed="true"] { outline: 2px dashed var(--accent-blue, #3b82f6); outline-offset: 2px; transition: outline-color 0.2s ease; }`;
  document.head.appendChild(style);
  styleInjected = true;
}

export function AIShowContributions() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    ensureStyle();
  }, []);

  const toggle = useCallback(() => {
    setActive((prev) => {
      const next = !prev;
      // Find the closest tab content container (the flex parent holding tab content)
      const container = document.querySelector('[data-tab-content]');
      if (container) {
        if (next) {
          container.classList.add(HIGHLIGHT_CLASS);
        } else {
          container.classList.remove(HIGHLIGHT_CLASS);
        }
      }
      return next;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const container = document.querySelector('[data-tab-content]');
      if (container) {
        container.classList.remove(HIGHLIGHT_CLASS);
      }
    };
  }, []);

  return (
    <button
      onClick={toggle}
      className={[
        'px-2 py-1 text-xs font-medium rounded transition-colors',
        active
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
          : 'text-gray-500 hover:text-gray-300 border border-transparent',
      ].join(' ')}
      title={active ? 'Hide AI contributions highlighting' : 'Highlight all AI-contributed content'}
      aria-pressed={active}
    >
      {active ? 'AI Shown' : 'Show AI'}
    </button>
  );
}
