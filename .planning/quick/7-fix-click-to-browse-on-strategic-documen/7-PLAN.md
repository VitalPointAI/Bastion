---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/strategic/DocumentUpload.tsx
  - frontend/src/components/strategic/DocumentUpload.css
autonomous: true
requirements: [QUICK-7]

must_haves:
  truths:
    - "Clicking anywhere on the upload dropzone opens the native file explorer"
    - "Drag-and-drop still works as before"
    - "After selecting a file via click, the file preview appears with name and size"
  artifacts:
    - path: "frontend/src/components/strategic/DocumentUpload.tsx"
      provides: "Click handler wired to hidden file input via useRef"
    - path: "frontend/src/components/strategic/DocumentUpload.css"
      provides: "File input styling that does not block interaction"
  key_links:
    - from: "upload-dropzone onClick"
      to: "fileInputRef.click()"
      via: "React ref"
      pattern: "inputRef\\.current\\.click"
---

<objective>
Fix the click-to-browse functionality on the strategic documents upload dialog. Currently only drag-and-drop works; clicking the dropzone area does not open the file explorer.

Purpose: The upload area displays "or click to browse" but clicking does nothing because the hidden file input overlay lacks proper z-index stacking. The fix replaces the fragile CSS overlay approach with a reliable useRef + onClick pattern.

Output: Working click-to-browse on the strategic document upload dropzone.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/strategic/DocumentUpload.tsx
@frontend/src/components/strategic/DocumentUpload.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix click-to-browse using useRef pattern and clean up CSS</name>
  <files>frontend/src/components/strategic/DocumentUpload.tsx, frontend/src/components/strategic/DocumentUpload.css</files>
  <action>
The bug: The `<input type="file">` inside `.drop-prompt` uses `position: absolute` with `width/height: 100%` to overlay the dropzone, but it lacks a z-index so click events get intercepted by sibling elements (SVGs, text spans) stacked above it in the paint order. This makes the "click to browse" text misleading since clicks do nothing.

Fix approach: Replace the CSS overlay hack with a proper React ref pattern. This is more reliable and avoids stacking/z-index fragility.

In DocumentUpload.tsx:
1. Add `useRef` to the import from 'react' (line 8)
2. Create a ref: `const fileInputRef = useRef<HTMLInputElement>(null);`
3. Add an onClick handler to the `.upload-dropzone` div (line 122-128) that triggers the file input:
   ```
   const handleClick = () => {
     if (!file) {
       fileInputRef.current?.click();
     }
   };
   ```
   Add `onClick={handleClick}` to the `.upload-dropzone` div.
4. Add `ref={fileInputRef}` to the `<input type="file">` element (line 171-175)

In DocumentUpload.css:
5. Update the `.file-input` class (lines 117-125) to use `display: none` instead of the absolute positioning overlay. Remove `position: absolute`, `top: 0`, `left: 0`, `width: 100%`, `height: 100%`, `opacity: 0`, `cursor: pointer`. Replace with just `display: none;`

The dropzone div already has `cursor: pointer` in CSS (line 63), so no cursor change needed.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr/frontend && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Clicking the upload dropzone opens the file explorer. Drag-and-drop continues to work. TypeScript compiles without errors. The file input is hidden via display:none and triggered programmatically via ref.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- The file input is triggered via ref on dropzone click (grep for `fileInputRef`)
- The file input uses `display: none` instead of absolute positioning overlay
- Drag-and-drop handlers remain intact on the dropzone div
</verification>

<success_criteria>
- Clicking anywhere on the upload dropzone opens the native file browser dialog
- Drag-and-drop upload still works
- Selected file displays correctly with name and size
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/7-fix-click-to-browse-on-strategic-documen/7-SUMMARY.md`
</output>
