# Phase 61: Responsive UI & Mobile Optimization - Research

**Researched:** 2026-03-29
**Domain:** Tailwind CSS v4, CSS media queries, responsive layout patterns, mobile UX
**Confidence:** HIGH

## Summary

The BASTION frontend is a React 19 + Tailwind CSS v4.2.1 + Vite 7 application with a custom CSS variable design system layered on top of Tailwind utilities. The codebase uses a mixed approach: Tailwind utility classes in TSX files (mobile-first responsive prefixes like `lg:`, `sm:`) for newer components, and custom CSS files with `@media` blocks for older shell components. The two systems coexist without conflict because Tailwind v4 uses `@layer utilities` while App.css/component .css files are unlayered.

The six layout shell components — App/App.css, ProblemSetTabContainer, OrgTreeSidebar, IronclawDrawer, TabLayout/TabLayout.css, and ExerciseDashboard — are the highest-leverage targets. They control the entire viewport and their fixed pixel widths cascade into all content below them. The tab bar in ProblemSetTabContainer uses `whitespace-nowrap` on all 7 tabs with no scroll or wrap fallback — at small screens they simply overflow out of view. The IronclawDrawer is hardcoded to `width: '420px'` in inline style with only a `max-width: 639px` full-width override.

Tailwind v4 introduces a CSS-first configuration via `@theme` blocks in CSS files — no `tailwind.config.js` needed. Custom breakpoints are defined as `--breakpoint-*` CSS variables. The project currently uses only three breakpoints (640px, 768px, 1024px) with very sparse coverage (30 responsive class usages across 79+ components). Adding an `xl` breakpoint at 1280px and a tablet-specific breakpoint at 960px would fill the most critical gaps.

**Primary recommendation:** Work shell-outward, tab-bar first. Fix the 6 layout shells in Wave 1, then apply fluid/responsive patterns to the 7 major tab content areas in Wave 2, then clean up dialogs and data-dense components in Wave 3.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.2.1 (already installed) | Utility-first responsive classes | Already in use; v4 mobile-first default |
| @tailwindcss/vite | 4.2.1 (already installed) | Vite plugin integration | Already configured in vite.config.ts |
| CSS custom properties | Native (already in App.css) | Shell layout variables | `--header-height: 56px` already defined; extend for breakpoints |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Container Queries | Native (Tailwind v4 `@container`) | Component-level responsiveness | For components that live inside variable-width containers (tab content, sidebar panels) |
| CSS `clamp()` | Native | Fluid typography/sizing | Font sizes, paddings that scale smoothly between breakpoints |
| `100dvh` / `100svh` | Native (already used in App.css) | Mobile viewport height | Already applied to `.app` — expand to drawers/modals |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS @media in .css files | Tailwind responsive prefixes in TSX | CSS files are already in place for shells; refactoring to pure Tailwind is larger scope than needed |
| Container queries everywhere | Viewport media queries | Container queries are better for reusable components but add `@container` markup overhead; mix is appropriate |
| New responsive component library (e.g. daisyUI) | Extend existing patterns | Would require rewriting 79+ components; overkill for this phase |

## Architecture Patterns

### Recommended Breakpoint System

Add a custom `xl` breakpoint to align with the project's four target tiers. Tailwind v4 already defines `sm` (640px), `md` (768px), `lg` (1024px). Add to `index.css`:

```css
/* Source: https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  /* Add xl breakpoint — Tailwind v4 default is 80rem (1280px), which is correct */
  /* No override needed if 1280px is acceptable for xl */

  /* Add tablet-specific intermediate breakpoint if needed */
  --breakpoint-tablet: 60rem;  /* 960px — between md and lg */
}
```

For this project's targets, the existing Tailwind v4 defaults are sufficient:
- `sm`: 640px (mobile)
- `md`: 768px (tablet portrait)
- `lg`: 1024px (small laptop / tablet landscape)
- `xl`: 1280px (desktop) — already in Tailwind v4 defaults

### Recommended Project Structure

No new directories needed. Changes are in-place modifications to existing files:

```
frontend/src/
├── index.css                    # Add @theme block if custom breakpoints needed
├── App.css                      # Fix header grid → flex with wrap, remove 3-col constraint
├── components/
│   ├── ironclaw/
│   │   └── IronclawDrawer.tsx   # Replace width:'420px' inline style with responsive class
│   ├── tabs/
│   │   └── TabLayout.css        # Add tablet breakpoint (40px collapse at 768px is too aggressive)
│   ├── problem-set/
│   │   ├── ProblemSetTabContainer.tsx  # Tab bar: add overflow-x-auto + scroll snap
│   │   └── OrgTreeSidebar.tsx          # w-80 (320px) fine; ensure mobile is 100vw
│   └── [tab content components]/       # Wave 2: fluid padding, stacked grids on mobile
```

### Pattern 1: Shell-First, Content-Second

**What:** Fix layout shells (header, tab bar, sidebars, drawers) before touching content components. Shells constrain everything inside them — broken shells cascade.
**When to use:** Always. A fluid content panel inside a broken shell does nothing.
**Priority order:** App.css header → ProblemSetTabContainer tab bar → IronclawDrawer → TabLayout sidebar → OrgTreeSidebar → tab content

### Pattern 2: Replace Inline Fixed Pixel Widths with Responsive Clamp or Viewport Units

**What:** Inline styles like `width: '420px'` must become CSS classes or use `min(420px, 100vw)` / `clamp()`.
**When to use:** Any fixed px width on a fixed-position overlay/drawer.

```tsx
// Source: Tailwind CSS responsive design docs
// Before (IronclawDrawer.tsx line 268):
style={{ zIndex: 950, width: '420px', top: `${topOffset}px`, height: `calc(100vh - ${topOffset}px)` }}

// After — move to class, handle in CSS:
// In IronclawDrawer.css:
.ironclaw-drawer {
  width: 420px;
  width: min(420px, 100vw);  /* never exceeds viewport */
}
@media (max-width: 639px) {
  .ironclaw-drawer { width: 100%; }
}
@media (min-width: 640px) and (max-width: 1024px) {
  .ironclaw-drawer { width: min(380px, 90vw); } /* tablet: slightly narrower */
}
```

### Pattern 3: Tab Bar with Horizontal Scroll and Scroll Snap

**What:** Tab bars with `whitespace-nowrap` buttons overflow silently. Add `overflow-x-auto` + visual fade indicators instead of forcing wrap.
**When to use:** Any horizontal list of navigation items that could overflow.

```tsx
// Source: Tailwind CSS docs, shadcn.io/patterns/tabs-layout-3
// ProblemSetTabContainer.tsx - change the <nav> element:

<nav
  className={[
    // 'flex border-b shrink-0',  // BEFORE
    'flex border-b shrink-0 overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory',
    isTraining ? 'bg-amber-900/30 border-amber-700/50' : 'bg-gray-800 border-gray-700',
  ].join(' ')}
  role="tablist"
>
```

Add CSS to hide scrollbar while keeping scroll functionality:
```css
/* In index.css or ProblemSetTabContainer.css */
.snap-x { scroll-snap-type: x mandatory; }
.snap-mandatory button { scroll-snap-align: start; }
/* Hide scrollbar cross-browser */
.scrollbar-none { scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
```

### Pattern 4: App Header — Replace 3-Column Grid with Flex + Priority Hiding

**What:** The `.app-header` uses `grid-template-columns: auto 1fr auto` which prevents wrap. At ≤768px it switches to `grid-template-columns: 1fr` which stacks everything vertically — correct but the middle nav items need to handle varying content width.
**When to use:** Headers with variable-length center content.

```css
/* App.css — replace rigid grid with flex that collapses gracefully */
.app-header {
  display: flex;
  flex-wrap: wrap;          /* allows row break at small screens */
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 2rem;
}

.app-nav {
  flex: 1;
  min-width: 0;             /* allows flex children to shrink */
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;         /* scroll instead of overflow on mobile */
  scrollbar-width: none;
}

/* Hide ProblemSetBreadcrumb (verbose) on narrow screens */
.app-nav .problem-set-breadcrumb {
  display: none;
}
@media (min-width: 768px) {
  .app-nav .problem-set-breadcrumb { display: flex; }
}
```

### Pattern 5: Sidebar as Off-Canvas on Mobile

**What:** The TabLayout sidebar collapses to 40px at 768px but still occupies space. On mobile (< 640px), it should become an off-canvas overlay (position: fixed, full-height) triggered by the toggle button.
**When to use:** Any persistent sidebar that is navigation-only.

```css
/* TabLayout.css additions */
@media (max-width: 639px) {
  .tab-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100dvh;
    z-index: 200;
    width: 0;
    transform: translateX(-100%);
    transition: transform var(--transition-medium), width 0ms;
  }

  .tab-sidebar.open {
    width: 220px;
    transform: translateX(0);
  }
}
```

### Pattern 6: Container Queries for Self-Contained Panels

**What:** Panels that can appear in different-width containers (COP sub-panels, Resources panels) should use `@container` to be intrinsically responsive.
**When to use:** Reusable components rendered in multiple contexts.

```tsx
// Source: https://tailwindcss.com/docs/responsive-design (container queries section)
// Wrap the panel in a container context:
<div className="@container">
  <div className="flex flex-col @md:flex-row gap-4">
    {/* stacks on narrow, row on wider container */}
  </div>
</div>
```

### Anti-Patterns to Avoid

- **Hiding content with `display: none` at mobile:** Hides functionality. Prefer condensed display (icon-only, collapsed accordion) or off-canvas.
- **`overflow: hidden` on the entire app shell:** Already set on `html, body` — do NOT add `overflow: hidden` on inner flex containers that need natural scroll.
- **Using `px` units for breakpoints in CSS `@media`:** Use consistent units (px is fine in @media, rem in @theme for Tailwind breakpoints).
- **Inline px widths on overlays/drawers:** Always use `min(Xpx, 100vw)` or a CSS class — never bare `width: '420px'` style props on fixed-position elements.
- **Converting all CSS files to Tailwind classes:** The CSS/Tailwind hybrid is intentional and documented in index.css. Do not refactor working CSS files to Tailwind classes as a side effect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scrollable tab bar | Custom scroll detection + buttons | `overflow-x: auto` + `scrollbar-width: none` CSS | Browser handles scroll natively; touch scroll works for free |
| Responsive grid breakpoints | JS-based window resize listeners | Tailwind responsive prefixes or CSS @media | Zero JS overhead, no layout jank |
| Mobile viewport height | JS to measure window.innerHeight | `100dvh` (dynamic viewport height) | Already used in App.css; handles mobile browser chrome correctly |
| Off-canvas sidebar animation | JS-driven transform | CSS `transition: transform` + class toggle | Already pattern used by IronclawDrawer slide animation |
| Dialog responsive sizing | JS resize observer | `width: min(560px, 95vw)` | Already used in `PendingDecisionModal.tsx` — extend this pattern everywhere |

**Key insight:** Responsive UI in this codebase is almost entirely a CSS problem, not a JavaScript problem. The existing JS component logic does not need changes — only CSS values and Tailwind class additions.

## Common Pitfalls

### Pitfall 1: Tailwind v4 @theme Breakpoints Must Use Same Unit

**What goes wrong:** Defining some breakpoints in `rem` and others in `px` causes Tailwind v4 to sort media queries incorrectly — a `px` breakpoint may override a `rem` breakpoint it logically precedes.
**Why it happens:** Tailwind v4's CSS-first config sorts `--breakpoint-*` values numerically but cannot convert between units.
**How to avoid:** Use `rem` for all `@theme --breakpoint-*` definitions. Default breakpoints are in `rem` (`40rem`, `48rem`, `64rem`, `80rem`, `96rem`). Custom additions must also be `rem`.
**Warning signs:** A breakpoint class that should apply at 640px doesn't work, or applies at the wrong width.

### Pitfall 2: IronclawDrawer Push Layout Uses Hardcoded 420px in paddingRight

**What goes wrong:** In `App.tsx` line 119, `paddingRight` for the push layout is hardcoded to `'420px'`. If the drawer width is made responsive, this value must also be dynamic.
**Why it happens:** The width is set in two places — the inline style on the drawer element and the padding on `.app-main`.
**How to avoid:** Centralize the drawer width as a CSS custom property (`--ironclaw-width: 420px`) or read it from a shared constant. Update both the drawer width and the main padding from the same source.
**Warning signs:** Content is clipped or there is a gap between the drawer and content area on tablet.

### Pitfall 3: The Tab Bar's `whitespace-nowrap` Must Be Kept

**What goes wrong:** Removing `whitespace-nowrap` from tab buttons causes tab labels to wrap to two lines, making the tab bar variable height and breaking the layout below.
**Why it happens:** Tab labels like "Resources" are short enough to not wrap normally, but with padding changes they can.
**How to avoid:** Keep `whitespace-nowrap` and use `overflow-x-auto` on the container instead.
**Warning signs:** Tab bar height becomes inconsistent across breakpoints.

### Pitfall 4: `overflow: hidden` on `html, body` Blocks Mobile Scroll

**What goes wrong:** `html, body { overflow: hidden }` is set in index.css. This is intentional — the app is a full-viewport SPA. But if any interior container fails to set `min-height: 0` in a flex column, content truncates instead of scrolling.
**Why it happens:** Flex children default to `min-height: auto` which prevents shrinking below content height.
**How to avoid:** Ensure every `flex-col` container in the layout chain has `min-height: 0` on its flex children that need to scroll. The pattern already exists (`flex-1 min-h-0`) in ProblemSetTabContainer — verify it is present throughout the tab content chain.
**Warning signs:** Content is cut off at the bottom of the screen on mobile with no way to scroll to it.

### Pitfall 5: The 3-Column Header Grid Breaks on 1024-1280px Screens

**What goes wrong:** The `.app-header` `grid-template-columns: auto 1fr auto` works on large desktops but at 1024-1200px the middle column (nav with ProblemSetSwitcher + ProblemSetBreadcrumb + mode button) overflows into the UserStatusBar column.
**Why it happens:** `ProblemSetSwitcher` has a `min-width` that can exceed available space at 1024px.
**How to avoid:** Switch `.app-header` to `flex` with `flex-wrap: wrap` and give `.app-nav` `min-width: 0`. Alternatively, add a `max-width` to ProblemSetSwitcher with truncation.
**Warning signs:** UserStatusBar overlaps the navigation at 1024-1100px viewport width.

### Pitfall 6: OrgTreeSidebar `w-80` (320px) May Be Too Wide on Narrow Phones

**What goes wrong:** The OrgTreeSidebar uses `className="fixed inset-y-0 right-0 w-80 ..."`. On a 320px-wide phone this leaves no room for the backdrop.
**Why it happens:** `w-80` = 320px is a Tailwind fixed-width class with no responsive variant.
**How to avoid:** Change to `w-80 max-w-[90vw]` — the sidebar won't exceed 90% of viewport width on any device.
**Warning signs:** Sidebar fills entire screen on small phones, backdrop is invisible.

## Code Examples

Verified patterns from official sources and existing codebase:

### Adding a Custom Breakpoint in Tailwind v4 CSS-First Config

```css
/* Source: https://tailwindcss.com/docs/theme */
/* frontend/src/index.css */
@import "tailwindcss";

@theme {
  /* Only add if 960px intermediate breakpoint is needed */
  /* --breakpoint-tablet: 60rem; */  /* 960px */
}
```

### Fluid Dialog Width (Already Used in PendingDecisionModal)

```tsx
// Source: frontend/src/components/decide/PendingDecisionModal.tsx line 109
// This is the CORRECT pattern — extend it to all modals
style={{ width: 'min(560px, 95vw)' }}

// For smaller dialogs:
style={{ width: 'min(480px, 95vw)' }}

// For larger panels:
style={{ width: 'min(640px, 95vw)' }}
```

### Responsive IronclawDrawer Width (Proposed)

```css
/* Source: pattern from IronclawDrawer.css + App.tsx */
/* Add to IronclawDrawer.css */
.ironclaw-drawer {
  /* Replace inline width: '420px' */
  width: min(420px, 100vw);
}

@media (max-width: 639px) {
  .ironclaw-drawer {
    width: 100% !important;  /* already exists — keep */
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .ironclaw-drawer {
    width: min(380px, 92vw);  /* tablet: slightly narrower */
  }
}
```

### Scrollable Tab Bar with Hidden Scrollbar

```tsx
/* Source: shadcn.io/patterns/tabs-layout-3 + Tailwind docs */
/* ProblemSetTabContainer.tsx nav element update */
<nav
  className={[
    'flex border-b shrink-0 overflow-x-auto',
    isTraining ? 'bg-amber-900/30 border-amber-700/50' : 'bg-gray-800 border-gray-700',
  ].join(' ')}
  style={{ scrollbarWidth: 'none' }}
  role="tablist"
>
```

### App Header Responsive (Proposed App.css update)

```css
/* Source: App.css pattern + Tailwind responsive design docs */
@media (max-width: 1024px) {
  .app-header {
    padding: 0.5rem 1rem;
    gap: 0.75rem;
  }
}

/* NEW: handle 640-1024px range (tablet) specifically */
@media (max-width: 900px) {
  .app-header h1 {
    font-size: 1.1rem;
  }

  .nav-button {
    padding: 0.4rem 0.7rem;
    font-size: 0.78rem;
  }
}

@media (max-width: 640px) {
  .app-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* Hide verbose breadcrumb on mobile */
  .problem-set-breadcrumb {
    display: none;
  }
}
```

### OrgTreeSidebar Width Fix

```tsx
/* Source: OrgTreeSidebar.tsx line 50 */
/* Change: */
<div className="fixed inset-y-0 right-0 w-80 bg-gray-800 ...">

/* To: */
<div className="fixed inset-y-0 right-0 w-80 max-w-[90vw] bg-gray-800 ...">
```

### Container Query Pattern for Tab Content Panels

```tsx
/* Source: https://tailwindcss.com/docs/responsive-design#container-queries */
/* For panels inside TabLayout that need self-contained responsiveness */
<div className="@container flex-1 overflow-y-auto">
  <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-4 p-4">
    {/* cards auto-stack based on container, not viewport */}
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind config.js breakpoints | `@theme { --breakpoint-* }` in CSS | Tailwind v4 (early 2025) | No config.js needed; breakpoints defined in CSS |
| `100vh` for full-height | `100dvh` (dynamic viewport height) | Safari 15.4+ (2022), widely adopted 2023-24 | Already used in `.app` — prevents mobile browser chrome clipping |
| Fixed-width modals | `min(fixedPx, 95vw)` | Widely adopted pattern 2022-24 | Already used in `PendingDecisionModal` — should be universal |
| `window.innerWidth` JS resize for breakpoints | CSS `@media` / `@container` | Always CSS-first; confirmed best practice | No JS overhead for responsive layout |

**Deprecated/outdated:**
- `@media screen and (max-width: ...)` with the `screen` keyword: Modern CSS omits `screen`; both forms work but current convention is `@media (max-width: ...)`.
- `overflow: hidden` on tab bars to suppress scrollbar: Causes hidden content; replace with `scrollbar-width: none` + `overflow-x: auto`.

## Open Questions

1. **IronclawDrawer push-layout padding synchronization**
   - What we know: `App.tsx` line 119 hardcodes `paddingRight: ironclawOpen && PUSH_LAYOUT_TABS.has(currentTab) ? '420px' : 0`
   - What's unclear: If drawer width becomes responsive (e.g., 380px on tablet), this 420px value creates a gap. Should the width be read from a CSS custom property or a JS constant?
   - Recommendation: Define `const IRONCLAW_DRAWER_WIDTH = 420` in a shared constants file. Use it in both the drawer and App.tsx. The CSS-override for tablet/mobile overrides this via media query.

2. **Tab label abbreviation on narrow screens**
   - What we know: 7 tabs ("Understand", "Design", "Plan", "Decide", "COP", "Assess", "Resources") sum to ~180+ chars with padding. At 360px mobile width this overflows even with scroll.
   - What's unclear: Whether abbreviated labels ("Intel", "Ops") are acceptable to users, or whether scrollable tabs are sufficient UX.
   - Recommendation: Keep full labels but use scrollable tab bar (overflow-x-auto). The active tab should be auto-scrolled into view on tab change.

3. **Should ProblemSetBreadcrumb be hidden on mobile?**
   - What we know: The `ProblemSetBreadcrumb` is in `app-nav` and shows the current problem set hierarchy. It can be verbose.
   - What's unclear: Whether the breadcrumb is functionally important for mobile users or redundant (they already navigated to the problem set).
   - Recommendation: Hide `.problem-set-breadcrumb` below 768px. The active problem set name is visible in the tab container header.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 + @testing-library/react |
| Config file | `vite.config.ts` (vitest section) + `src/test-setup.ts` |
| Quick run command | `cd frontend && bash -lc 'npm run test:security'` (existing) OR `bash -lc 'npx vitest run src/components/ironclaw/ --reporter=verbose'` |
| Full suite command | `cd frontend && bash -lc 'npx vitest run --reporter=verbose'` |

### Phase Requirements → Test Map

Responsive UI is primarily a visual/browser concern — most correctness is verified by manual visual testing across breakpoints. However, key structural behaviors can be unit-tested:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESP-01 | IronclawDrawer renders with CSS class not inline width | unit | `npx vitest run src/components/ironclaw/IronclawDrawer.test.tsx -x` | Wave 0 |
| RESP-02 | OrgTreeSidebar has `max-w-[90vw]` class | unit | `npx vitest run src/components/problem-set/OrgTreeSidebar.test.tsx -x` | Wave 0 |
| RESP-03 | Tab bar nav has `overflow-x-auto` class | unit | `npx vitest run src/components/problem-set/ProblemSetTabContainer.test.tsx -x` | Wave 0 |
| RESP-04 | All modal/dialog widths use `min(Npx, 95vw)` pattern | manual | Visual test at 375px, 768px, 1280px | N/A - visual only |

### Sampling Rate

- **Per task commit:** `cd /home/vitalpointai/projects/ssr/frontend && bash -lc 'npx vitest run src/ --reporter=verbose 2>&1 | tail -20'`
- **Per wave merge:** Full vitest suite + manual browser verification at 375px/768px/1280px
- **Phase gate:** Full suite green + visual sign-off at all four breakpoints before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/components/ironclaw/IronclawDrawer.test.tsx` — covers RESP-01 (drawer class structure)
- [ ] `frontend/src/components/problem-set/OrgTreeSidebar.test.tsx` — covers RESP-02 (max-w guard)
- [ ] `frontend/src/components/problem-set/ProblemSetTabContainer.test.tsx` — covers RESP-03 (tab bar overflow)

Note: Existing test infrastructure (vitest + @testing-library/react) is already installed and working. No framework install needed. The above files simply do not exist yet.

## Sources

### Primary (HIGH confidence)

- [Tailwind CSS v4 Responsive Design Docs](https://tailwindcss.com/docs/responsive-design) — breakpoints, mobile-first approach, container queries, max-width variants
- [Tailwind CSS v4 Theme Variables Docs](https://tailwindcss.com/docs/theme) — @theme block, --breakpoint-* custom variables
- `/home/vitalpointai/projects/ssr/frontend/src/App.css` — current header grid layout, existing media queries
- `/home/vitalpointai/projects/ssr/frontend/src/components/ironclaw/IronclawDrawer.tsx` — inline 420px width, topOffset measurement
- `/home/vitalpointai/projects/ssr/frontend/src/components/tabs/TabLayout.css` — sidebar 220px/40px fixed widths
- `/home/vitalpointai/projects/ssr/frontend/src/components/problem-set/ProblemSetTabContainer.tsx` — 7-tab whitespace-nowrap bar, ML-auto actions

### Secondary (MEDIUM confidence)

- [shadcn.io Scrollable Tabs Pattern](https://www.shadcn.io/patterns/tabs-layout-3) — scrollable tab bar with hidden scrollbar CSS
- [Tailwind CSS v4 Custom Breakpoints Discussion](https://github.com/tailwindlabs/tailwindcss/discussions/15113) — rem-only constraint for @theme breakpoints

### Tertiary (LOW confidence)

- [Eleken Tabs UX Best Practices](https://www.eleken.co/blog-posts/tabs-ux) — general UX guidance on scrollable vs wrapping tabs (not Tailwind-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Tailwind v4 + CSS are already in use; no new dependencies needed
- Architecture: HIGH — patterns verified from official Tailwind v4 docs and existing codebase patterns
- Pitfalls: HIGH — identified from direct code inspection of the 6 shell components

**Research date:** 2026-03-29
**Valid until:** 2026-06-01 (Tailwind v4 stable; CSS standards stable)
