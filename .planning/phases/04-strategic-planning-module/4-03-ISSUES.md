# UAT Issues: Phase 4 Plan 3

**Tested:** 2026-01-19
**Source:** .planning/phases/04-strategic-planning-module/4-03-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: ExtractionService hardcoded to Anthropic Claude - no provider configurability

**Discovered:** 2026-01-19
**Phase/Plan:** 4-03
**Severity:** Major
**Feature:** LLM Objective Extraction
**Description:** The ExtractionService is hardcoded to use Anthropic Claude SDK. There is no admin configuration capability to select alternative LLM providers. Military and government deployments may require:
- Self-hosted options (Ollama, LocalAI, vLLM)
- Alternative cloud providers (OpenAI, Azure OpenAI, AWS Bedrock)
- Air-gapped deployment support
**Expected:** Administrator ability to configure LLM provider through settings, with support for multiple backends including local AI options.
**Actual:** Hardcoded `new Anthropic()` client with no abstraction layer or provider configuration.
**Repro:**
1. Open `backend/src/strategic/extraction/extractor.ts`
2. Line 70: `this.anthropic = new Anthropic({...})`
3. No provider interface or configuration mechanism exists

## Resolved Issues

[None yet]

---

*Phase: 04-strategic-planning-module*
*Plan: 03*
*Tested: 2026-01-19*
