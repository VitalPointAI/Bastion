# UAT Issues: Phase 4 Plan 1

**Tested:** 2026-01-17
**Source:** .planning/phases/04-strategic-planning-module/4-01-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None]

## Resolved Issues

### UAT-001: DOCX upload fails with MIME type detection

**Discovered:** 2026-01-17
**Resolved:** 2026-01-17 - Fixed in 4-01-FIX.md
**Commit:** f8ebd54
**Phase/Plan:** 4-01
**Severity:** Major
**Feature:** Document upload (DOCX support)
**Description:** DOCX file upload fails because multer's file filter relies solely on the client-provided MIME type. When curl (or other clients) sends `application/octet-stream` instead of the proper DOCX MIME type, the upload is rejected.
**Resolution:** Added `getMimeTypeFromExtension()` helper and fallback logic in multer fileFilter to detect file type from extension when MIME is octet-stream.

---

*Phase: 04-strategic-planning-module*
*Plan: 01*
*Tested: 2026-01-17*
