# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-001: Interactive AI Chat Assistant Sidebar

- **Discovered:** Phase 3 Task 3-08 (2026-01-17)
- **Type:** UX / Feature Enhancement
- **Description:** Replace static CopilotPanel with interactive conversational AI assistant as a collapsible sidebar (VSCode-style). Features:
  - Multiple model providers (Claude, GPT-4, local models, NEAR AI integration)
  - Context-aware focus adapting to what user is viewing (proposal, DAO, strategic docs)
  - Model selection and mode switching
  - Full chat history with streaming responses
  - Classification-aware context access (strategic/operational/tactical doctrine)
- **Impact:** Low (current static analysis works, this would significantly enhance UX)
- **Effort:** Substantial (requires model provider integrations, chat UI, context management)
- **Suggested phase:** Phase 4 or dedicated AI Enhancement phase

### ISS-002: Pinata API 403 Error

- **Discovered:** Phase 1 Task 1-04 (2026-01-11)
- **Type:** Configuration
- **Description:** Backend IPFS upload endpoint returns 403 from Pinata API. Possible causes: JWT needs regeneration, API endpoint format changed, or permissions need adjustment.
- **Impact:** Low (does not block development)
- **Effort:** Quick (regenerate JWT in Pinata dashboard)
- **Suggested phase:** Phase 4 or when IPFS uploads needed

## Closed Enhancements

[Moved here when addressed]
