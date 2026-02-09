---
status: diagnosed
trigger: "Diagnose the passkey authentication TypeError - Cannot read properties of undefined (reading 'replace') at authenticateWithPasskey"
created: 2026-02-01T00:00:00Z
updated: 2026-02-01T00:01:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - API mismatch between @simplewebauthn/browser v10 and v13 calling convention
test: Compared v10 vs v13 startAuthentication function signatures
expecting: Different API between versions
next_action: Return diagnosis

## Symptoms

expected: Passkey authentication works without errors
actual: TypeError: Cannot read properties of undefined (reading 'replace') at authenticateWithPasskey
errors: passkey.ts:74 TypeError: Cannot read properties of undefined (reading 'replace')
reproduction: Attempt passkey authentication
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-02-01T00:00:30Z
  checked: frontend/package.json @simplewebauthn/browser version
  found: Version ^10.0.0 specified
  implication: Frontend uses v10 API

- timestamp: 2026-02-01T00:00:35Z
  checked: backend/package.json @simplewebauthn/server version
  found: Version ^13.2.2 specified
  implication: Backend generates v13-format options

- timestamp: 2026-02-01T00:00:40Z
  checked: frontend/src/lib/passkey.ts line 74
  found: Code calls startAuthentication({ optionsJSON: options }) - this is v13 syntax
  implication: Frontend code uses v13 calling convention

- timestamp: 2026-02-01T00:00:45Z
  checked: @simplewebauthn/browser v10 startAuthentication signature
  found: function startAuthentication(optionsJSON, useBrowserAutofill = false) - expects optionsJSON directly
  implication: v10 API expects options as first param, not wrapped in object

- timestamp: 2026-02-01T00:00:50Z
  checked: @simplewebauthn/browser v13 startAuthentication signature
  found: function startAuthentication(options) { const { optionsJSON, ... } = options } - expects wrapped object
  implication: v13 API expects { optionsJSON, useBrowserAutofill } object

- timestamp: 2026-02-01T00:00:55Z
  checked: base64URLStringToBuffer function in v10
  found: Line 13: const base64 = base64URLString.replace(/-/g, '+')...
  implication: This is where .replace() is called on undefined

## Resolution

root_cause: API version mismatch - frontend calls startAuthentication({ optionsJSON: options }) using v13 syntax, but @simplewebauthn/browser v10.0.0 expects startAuthentication(options) directly. The v10 function receives { optionsJSON: options } as its first param, then accesses .challenge which is undefined, causing base64URLStringToBuffer(undefined) to throw TypeError on .replace()
fix: Upgrade @simplewebauthn/browser from ^10.0.0 to ^13.2.2 to match server version
verification:
files_changed: []
