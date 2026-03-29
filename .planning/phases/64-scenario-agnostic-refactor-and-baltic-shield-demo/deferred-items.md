# Deferred Items — Phase 64

## Out-of-Scope Items Discovered During 64-01 Execution

### 1. order-generator.ts hardcoded team labels (backend)
- **File:** `backend/src/exercise/order-generator.ts`
- **Lines:** 86-87, 110, 113-114, 147, 212, 361, 582, 604
- **Issue:** Hardcoded "CJTF WestPAC" and "PRC/TCC" strings in LLM prompt generation
- **Status:** Out of scope for 64-01 (not in files_modified). Should be addressed when order-generator is parameterized.
- **Suggested fix:** Pass teamConfig as parameter to generateWARNORD/generateOPORD/generateFRAGO functions

### 2. COPRobotLayer.tsx hardcoded calibration constants (frontend)
- **File:** `frontend/src/components/cop/COPRobotLayer.tsx`
- **Lines:** 105, 111, 119
- **Issue:** Hardcoded CAL_SOUTH/NORTH constants (Taipei coordinates) — not using CalibrationService
- **Status:** Out of scope for 64-01 (frontend cannot import backend CalibrationService). Should be addressed via a frontend calibration API call or shared config.
- **Suggested fix:** Add `/api/robots/calibration/profiles/default` fetch on mount; replace hardcoded values

### 3. COPGateNotifications.tsx hardcoded calibration constants (frontend)
- **File:** `frontend/src/components/cop/COPGateNotifications.tsx`
- **Lines:** 33, 39
- **Issue:** Same as COPRobotLayer.tsx — hardcoded Taipei CAL_SOUTH/NORTH
- **Status:** Out of scope for 64-01
- **Suggested fix:** Same as #2
