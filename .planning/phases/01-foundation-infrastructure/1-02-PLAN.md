---
phase: 01-foundation-infrastructure
plan: 02
type: execute
---

<objective>
Create React frontend with Vite build tooling, TypeScript, and Privy authentication for Web2-style user experience with embedded NEAR wallets.

Purpose: Establish the frontend foundation with complete blockchain abstraction - users login with email/social, never see wallets or seed phrases.
Output: Working React application with Privy authentication, embedded NEAR wallets, and connection to FastNEAR RPC.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
./summary.md
~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation-infrastructure/1-RESEARCH.md
@.planning/phases/01-foundation-infrastructure/1-CONTEXT.md
@.planning/phases/01-foundation-infrastructure/1-01-SUMMARY.md

**Tech stack available:**
- NEAR Rust smart contracts with state versioning
- workspaces-rs testing framework
- cargo-near and near-cli-rs tooling

**Established patterns:**
- State versioning with enums
- Early validation with require!
- Testing with workspaces-rs sandbox

**From RESEARCH.md:**
- Use Vite 5.x+ for fast HMR and optimized builds
- pnpm 9.x+ for package management (fast, disk-efficient)
- React 18.x+ with TypeScript 5.x+
- Privy.io for authentication with embedded NEAR wallets
- FastNEAR for optimized NEAR RPC
- Don't hand-roll: wallet management (Privy abstracts it), authentication (use Privy SDK)

**From CONTEXT.md:**
- Complete blockchain abstraction - users never see wallets, gas, seed phrases
- Login with email, social accounts, or biometric (Privy)
- Zero blockchain training required for end users
- Critical requirement: ALL phases maintain complete blockchain abstraction
- If users see blockchain terminology, it's a bug
</context>

<tasks>

<task type="auto">
  <name>Task 1: Initialize Vite + React + TypeScript frontend</name>
  <files>frontend/package.json, frontend/src/main.tsx, frontend/src/App.tsx, frontend/vite.config.ts, frontend/tsconfig.json</files>
  <action>
    Set up modern frontend development environment with Vite, React, and TypeScript:

    1. Install pnpm globally if not present: npm install -g pnpm
    2. Create Vite project: pnpm create vite frontend --template react-ts
    3. Navigate to frontend/ and install dependencies: pnpm install

    4. Configure vite.config.ts:
       - Set up dev server port (default 5173)
       - Configure proxy for backend API calls (future)
       - Enable optimized dependencies pre-bundling

    5. Set up basic project structure:
       - src/components/ (React components)
       - src/lib/ (utility functions, NEAR integration)
       - src/hooks/ (React hooks)
       - src/types/ (TypeScript types)

    6. Create basic App.tsx structure:
       - Clean up Vite template boilerplate
       - Simple layout shell (header, main content area)
       - Placeholder for authentication component

    Use pnpm instead of npm/yarn (faster, more efficient, strict dependency resolution).
    Use Vite instead of Create React App (much faster dev server, better build optimization, modern ESM).
    TypeScript strict mode enabled from start (prevents type issues later).
  </action>
  <verify>
    - pnpm dev starts dev server successfully
    - Browser loads http://localhost:5173 without errors
    - Hot module replacement works (edit file, see update without refresh)
    - pnpm build creates optimized production bundle
    - No TypeScript errors in terminal or browser console
  </verify>
  <done>Vite dev server running, React app loads successfully, TypeScript compilation clean, basic project structure established, HMR functional</done>
</task>

<task type="auto">
  <name>Task 2: Integrate Privy authentication with embedded NEAR wallets</name>
  <files>frontend/src/main.tsx, frontend/src/components/AuthWrapper.tsx, frontend/src/components/LoginButton.tsx, frontend/.env.local</files>
  <action>
    Integrate Privy.io for Web2-style authentication with automatic NEAR wallet creation:

    1. Install Privy SDK: pnpm add @privy-io/react-auth @privy-io/server-auth

    2. Register application at privy.io:
       - Create account (if needed)
       - Create new app
       - Get App ID from dashboard
       - Configure allowed domains (localhost for dev)

    3. Create .env.local with:
       - VITE_PRIVY_APP_ID=[app_id]
       - VITE_NEAR_NETWORK=testnet
       - VITE_NEAR_RPC=https://rpc.testnet.near.org (FastNEAR endpoint)

    4. Wrap app with PrivyProvider in main.tsx:
       - Import PrivyProvider
       - Configure loginMethods: ['email', 'google', 'twitter']
       - Enable embeddedWallets.createOnLogin: 'users-without-wallets'
       - Disable requireUserPasswordOnCreate (seamless UX)
       - Set supportedChains to NEAR testnet

    5. Create AuthWrapper component:
       - Use usePrivy hook for authentication state
       - Use useWallets hook for embedded wallet access
       - Extract NEAR wallet address (user's account ID)
       - Display user authentication status

    6. Create LoginButton component:
       - Call privy.login() on click (opens modal with email/social options)
       - Show user's NEAR account ID when authenticated
       - Logout button calling privy.logout()

    Follow Privy best practices: let Privy handle wallet creation automatically, never expose private keys, use embedded wallets instead of external wallet connectors.

    Don't hand-roll: wallet management (Privy creates NEAR accounts automatically), authentication flows (Privy SDK handles OAuth2, WebAuthn), account recovery (Privy provides email recovery).

    CRITICAL: No blockchain terminology in UI - "Login" not "Connect Wallet", "Account" not "Wallet Address", never show seed phrases.
  </action>
  <verify>
    - Login button opens Privy modal with email/Google/Twitter options
    - After email login, user authenticated successfully
    - Embedded NEAR wallet created automatically (check useWallets hook)
    - NEAR account ID displayed (format: username.testnet or similar)
    - Logout works and clears session
    - No errors in console
  </verify>
  <done>Privy authentication functional with email and social login, embedded NEAR wallets created automatically on first login, user can login/logout successfully, NEAR account accessible via useWallets hook</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Web2-style authentication with blockchain abstraction</what-built>
  <how-to-verify>
    Test the complete authentication flow to verify blockchain is completely abstracted:

    1. Run dev server: cd frontend && pnpm dev
    2. Visit: http://localhost:5173
    3. Click login button (should say "Login" not "Connect Wallet")
    4. Choose login method:
       - Email: Enter email, check inbox for code, verify
       - Google: OAuth flow, approve
       - Twitter: OAuth flow, approve
    5. After successful login, verify:
       - User is authenticated (UI shows logged-in state)
       - No wallet installation prompts
       - No seed phrase displayed or required
       - UI shows user account (not "wallet address")
       - Inspect console useWallets hook returns NEAR wallet object
    6. Test logout:
       - Click logout button
       - Verify session cleared
       - Can login again successfully
    7. Critical validation:
       - No blockchain terminology anywhere in UI
       - No gas fees mentioned
       - No transaction signing prompts (not testing transactions yet)
       - Experience feels like Gmail/Twitter, not MetaMask

    Expected behavior: Seamless Web2-style login experience with blockchain completely abstracted.
  </how-to-verify>
  <resume-signal>Type "approved" if authentication abstraction is complete, or describe any blockchain terminology visible in UI</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] pnpm dev and pnpm build both succeed without errors
- [ ] Privy authentication works with email and social logins
- [ ] Embedded NEAR wallet created automatically
- [ ] User can login and logout successfully
- [ ] No blockchain terminology in UI (verified in checkpoint)
- [ ] NEAR account accessible via useWallets hook
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from build or runtime
- Privy authentication fully functional with embedded NEAR wallets
- Complete blockchain abstraction maintained in UI
- Ready for NEAR contract interaction in subsequent plans
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-02-SUMMARY.md`:

# Phase 1 Plan 2: Frontend Foundation & Authentication Summary

**React frontend with Privy authentication provides Web2-style user experience with embedded NEAR wallets**

## Accomplishments

- Vite + React + TypeScript development environment established
- pnpm package management configured
- Privy.io integrated for authentication
- Email and social login functional (Google, Twitter)
- Embedded NEAR wallets created automatically on login
- Complete blockchain abstraction maintained in UI
- FastNEAR RPC endpoint configured

## Files Created/Modified

- `frontend/package.json` - Dependencies and scripts
- `frontend/vite.config.ts` - Vite configuration
- `frontend/src/main.tsx` - App entry point with PrivyProvider
- `frontend/src/components/AuthWrapper.tsx` - Authentication state management
- `frontend/src/components/LoginButton.tsx` - Login/logout UI
- `frontend/.env.local` - Environment configuration (Privy App ID, NEAR RPC)

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Ready for [1-03-PLAN.md](1-03-PLAN.md): IPFS Decentralized Storage
</output>
