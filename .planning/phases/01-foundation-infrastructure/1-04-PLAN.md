---
phase: 01-foundation-infrastructure
plan: 04
type: execute
priority: CRITICAL
note: "SECURITY MIGRATION - Move secrets from frontend to backend immediately"
---

<objective>
CRITICAL SECURITY MIGRATION: Move all sensitive operations (IPFS uploads, encryption, API keys) from frontend to secure backend environment, implementing sealed secrets management and preparing TEE foundation for future Phala integration.

Purpose: Fix critical security vulnerability where Pinata JWT and encryption keys are exposed in frontend. Establish secure backend API that will run in Phala TEE (Phase 1-05), but implement immediately with standard Node.js backend to unblock development.
Output: Backend API with sealed secrets, all sensitive operations moved from frontend, encryption and IPFS handled server-side, frontend calling secure backend endpoints.
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
@.planning/phases/01-foundation-infrastructure/1-CONTEXT.md
@.planning/phases/01-foundation-infrastructure/1-03-PLAN.md
@.planning/phases/01-foundation-infrastructure/1-03A-PLAN.md
@.planning/phases/01-foundation-infrastructure/SECURITY-MIGRATION-TRACKER.md

**CRITICAL SECURITY ISSUE:**
Currently (Plan 1-03), sensitive operations are exposed in frontend:
- `frontend/src/lib/ipfs.ts` - IPFS client with Pinata JWT in browser
- `frontend/src/lib/encryption.ts` - Encryption keys generated in browser
- `frontend/.env.local` - Contains `VITE_PINATA_JWT` and `VITE_FASTNEAR_API_KEY`

This violates Verifiable Zero Trust architecture. All secrets MUST move to backend immediately.

**From SECURITY-MIGRATION-TRACKER.md:**
Required Changes:
1. Move IPFS upload to backend API
2. Move encryption key generation to backend
3. Remove Pinata JWT from frontend env vars
4. Frontend only calls backend API, receives encrypted results

**Implementation Strategy:**
- Phase 1-04 (THIS PLAN): Immediate security fix with standard Node.js backend
- Phase 1-05 (NEXT): Migrate to Phala TEE for hardware attestation
- This allows development to continue while TEE integration is in progress

**Tech Stack:**
- Node.js/Express backend with TypeScript
- PostgreSQL from Plan 1-03A (dual-write pattern)
- Sealed secrets (.env with encryption)
- IPFS via Pinata (backend only)
- XChaCha20-Poly1305 encryption (server-side)
- Prepare for Phala TEE migration (Phase 1-05)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Set up secure Node.js backend with sealed secrets</name>
  <files>backend/package.json, backend/src/index.ts, backend/.env, backend/.env.example, backend/tsconfig.json, docker-compose.yml</files>
  <action>
    Create secure backend API that will host all sensitive operations:

    1. Initialize backend directory:
       ```bash
       mkdir -p backend/src
       cd backend
       pnpm init
       ```

    2. Install dependencies:
       ```bash
       pnpm add express cors dotenv pg axios form-data @noble/ciphers near-api-js
       pnpm add -D typescript @types/express @types/cors @types/node @types/pg tsx nodemon
       ```

    3. Create backend/tsconfig.json:
       ```json
       {
         "compilerOptions": {
           "target": "ES2022",
           "module": "ES2022",
           "moduleResolution": "node",
           "lib": ["ES2022"],
           "outDir": "./dist",
           "rootDir": "./src",
           "strict": true,
           "esModuleInterop": true,
           "skipLibCheck": true,
           "forceConsistentCasingInFileNames": true,
           "resolveJsonModule": true
         },
         "include": ["src/**/*"],
         "exclude": ["node_modules"]
       }
       ```

    4. Create backend/package.json scripts:
       ```json
       {
         "scripts": {
           "dev": "tsx watch src/index.ts",
           "build": "tsc",
           "start": "node dist/index.js"
         }
       }
       ```

    5. Create backend/.env (SECRETS - NEVER COMMIT):
       ```bash
       # Backend secrets (MOVE FROM FRONTEND)
       PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       FASTNEAR_API_KEY=3c1b8c4dfab4e640040dd3009e1ccec93fcb84409f88ce220aa398750e20edac

       # Database (from Plan 1-03A)
       DATABASE_URL=postgresql://postgres:password@localhost:5432/coalition_ops

       # Encryption master key (generate: openssl rand -hex 32)
       ENCRYPTION_MASTER_KEY=<generate_new_key>

       # Public config
       NEAR_NETWORK=testnet
       NEAR_RPC=https://rpc.testnet.fastnear.com
       PINATA_GATEWAY=https://coffee-kind-eagle-207.mypinata.cloud

       # Backend config
       PORT=3001
       NODE_ENV=development
       ```

    6. Create backend/.env.example (public template):
       ```bash
       PINATA_JWT=your_pinata_jwt_here
       FASTNEAR_API_KEY=your_fastnear_api_key_here
       DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
       ENCRYPTION_MASTER_KEY=generate_with_openssl_rand
       PORT=3001
       NODE_ENV=development
       ```

    7. Update .gitignore:
       ```
       backend/.env
       backend/dist/
       backend/node_modules/
       ```

    8. Create backend/src/index.ts (basic server):
       ```typescript
       import express from 'express';
       import cors from 'cors';
       import dotenv from 'dotenv';

       dotenv.config();

       const app = express();
       const port = process.env.PORT || 3001;

       app.use(cors());
       app.use(express.json());

       app.get('/health', (req, res) => {
         res.json({ status: 'healthy', timestamp: new Date().toISOString() });
       });

       app.listen(port, () => {
         console.log(`Backend listening on port ${port}`);
         console.log(`Environment: ${process.env.NODE_ENV}`);
       });
       ```

    9. Update docker-compose.yml (add backend service):
       ```yaml
       services:
         backend:
           build: ./backend
           container_name: backend
           ports:
             - "3001:3001"
           environment:
             - NODE_ENV=development
             - DATABASE_URL=postgresql://postgres:password@postgres:5432/coalition_ops
           env_file:
             - ./backend/.env
           depends_on:
             - postgres
           networks:
             - backend
           volumes:
             - ./backend/src:/app/src
       ```

    This creates the foundation for secure backend operations. Phala TEE integration (Plan 1-05) will wrap this same API in hardware attestation.

    Don't hand-roll: HTTP server (use Express), environment variables (use dotenv), CORS (use cors middleware), TypeScript compilation (use tsc).
  </action>
  <verify>
    - backend/package.json created with dependencies
    - pnpm install succeeds
    - pnpm dev starts server
    - curl http://localhost:3001/health returns 200
    - .env exists and contains PINATA_JWT
    - .env is in .gitignore (verify with: git status)
  </verify>
  <done>Node.js backend initialized with TypeScript; Express server running on port 3001; sealed secrets in .env (not committed); health endpoint working; ready for sensitive operations migration</done>
</task>

<task type="auto">
  <name>Task 2: Move encryption operations from frontend to backend</name>
  <files>backend/src/lib/encryption.ts, backend/src/api/encryption.ts, backend/src/index.ts, frontend/src/lib/encryption.ts</files>
  <action>
    Migrate all encryption operations to backend with server-side key generation:

    1. Create backend/src/lib/encryption.ts (moved from frontend):
       ```typescript
       import crypto from 'crypto';
       import { xchacha20poly1305 } from '@noble/ciphers/chacha';

       const KEY_LENGTH = 32; // 256 bits
       const NONCE_LENGTH = 24; // 192 bits for XChaCha20

       /**
        * Generate encryption key using Node.js crypto (server-side RNG)
        */
       export async function generateEncryptionKey(): Promise<string> {
         const key = crypto.randomBytes(KEY_LENGTH);
         return key.toString('hex');
       }

       /**
        * Encrypt data using XChaCha20-Poly1305
        */
       export async function encryptData(
         data: string | Buffer,
         key: string
       ): Promise<{ encrypted: string; nonce: string }> {
         const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
         const keyBuffer = Buffer.from(key, 'hex');
         const nonce = crypto.randomBytes(NONCE_LENGTH);

         const cipher = xchacha20poly1305(keyBuffer, nonce);
         const encrypted = cipher.encrypt(dataBuffer);

         return {
           encrypted: Buffer.from(encrypted).toString('base64'),
           nonce: nonce.toString('hex')
         };
       }

       /**
        * Decrypt data using XChaCha20-Poly1305
        */
       export async function decryptData(
         encrypted: string,
         key: string,
         nonce: string
       ): Promise<Buffer> {
         const encryptedBuffer = Buffer.from(encrypted, 'base64');
         const keyBuffer = Buffer.from(key, 'hex');
         const nonceBuffer = Buffer.from(nonce, 'hex');

         const cipher = xchacha20poly1305(keyBuffer, nonceBuffer);
         const decrypted = cipher.decrypt(encryptedBuffer);
         return Buffer.from(decrypted);
       }
       ```

    2. Create backend/src/api/encryption.ts:
       ```typescript
       import express from 'express';
       import { encryptData, decryptData, generateEncryptionKey } from '../lib/encryption.js';

       const router = express.Router();

       router.post('/encrypt', async (req, res) => {
         const { data } = req.body;
         if (!data) return res.status(400).json({ error: 'Data required' });

         try {
           const key = await generateEncryptionKey();
           const result = await encryptData(data, key);
           res.json({ ...result, key });
         } catch (error: any) {
           res.status(500).json({ error: error.message });
         }
       });

       router.post('/decrypt', async (req, res) => {
         const { encrypted, key, nonce } = req.body;
         if (!encrypted || !key || !nonce) {
           return res.status(400).json({ error: 'Missing required fields' });
         }

         try {
           const decrypted = await decryptData(encrypted, key, nonce);
           res.json({ data: decrypted.toString('utf-8') });
         } catch (error: any) {
           res.status(500).json({ error: error.message });
         }
       });

       export default router;
       ```

    3. Update backend/src/index.ts to mount routes:
       ```typescript
       import encryptionRouter from './api/encryption.js';

       // Add after existing middleware
       app.use('/api/encryption', encryptionRouter);
       ```

    4. Update frontend/src/lib/encryption.ts (proxy to backend):
       ```typescript
       const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';

       export async function encryptData(data: string) {
         const response = await fetch(`${BACKEND_URL}/api/encryption/encrypt`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ data })
         });
         return response.json();
       }

       export async function decryptData(encrypted: string, key: string, nonce: string) {
         const response = await fetch(`${BACKEND_URL}/api/encryption/decrypt`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ encrypted, key, nonce })
         });
         const result = await response.json();
         return result.data;
       }
       ```

    Security improvement: Keys now generated with Node.js crypto.randomBytes (better entropy than browser crypto).

    Don't hand-roll: Random number generation (use crypto.randomBytes), encryption algorithms (use @noble/ciphers), key management (server-side only).
  </action>
  <verify>
    - POST http://localhost:3001/api/encryption/encrypt with test data
    - Verify returns { encrypted, nonce, key }
    - POST /api/encryption/decrypt with returned values
    - Verify returns original data
    - Frontend encryptData() successfully calls backend
    - No encryption keys in frontend code
  </verify>
  <done>Encryption moved to backend; server-side key generation with crypto.randomBytes; XChaCha20-Poly1305 encryption on server; frontend proxies to backend API; no cryptographic operations in browser</done>
</task>

<task type="auto">
  <name>Task 3: Move IPFS uploads from frontend to backend</name>
  <files>backend/src/lib/ipfs.ts, backend/src/api/documents.ts, backend/src/index.ts, frontend/src/lib/ipfs.ts</files>
  <action>
    Migrate IPFS upload operations to backend with Pinata JWT secured server-side:

    1. Create backend/src/lib/ipfs.ts (moved from frontend):
       ```typescript
       import axios from 'axios';
       import FormData from 'form-data';

       const PINATA_JWT = process.env.PINATA_JWT!;
       const PINATA_API_URL = 'https://api.pinata.cloud';
       const PINATA_GATEWAY = process.env.PINATA_GATEWAY!;

       if (!PINATA_JWT) {
         throw new Error('PINATA_JWT not configured');
       }

       export async function uploadToIPFS(
         data: Buffer,
         filename: string
       ): Promise<{ cid: string; size: number }> {
         const formData = new FormData();
         formData.append('file', data, filename);

         const response = await axios.post(
           `${PINATA_API_URL}/pinning/pinFileToIPFS`,
           formData,
           {
             headers: {
               'Authorization': `Bearer ${PINATA_JWT}`,
               ...formData.getHeaders()
             },
             maxBodyLength: Infinity
           }
         );

         return {
           cid: response.data.IpfsHash,
           size: response.data.PinSize
         };
       }

       export async function retrieveFromIPFS(cid: string): Promise<Buffer> {
         const response = await axios.get(`${PINATA_GATEWAY}/ipfs/${cid}`, {
           responseType: 'arraybuffer'
         });
         return Buffer.from(response.data);
       }
       ```

    2. Create backend/src/api/documents.ts:
       ```typescript
       import express from 'express';
       import multer from 'multer';
       import { encryptData } from '../lib/encryption.js';
       import { uploadToIPFS } from '../lib/ipfs.js';

       const router = express.Router();
       const upload = multer({
         storage: multer.memoryStorage(),
         limits: { fileSize: 100 * 1024 * 1024 } // 100MB
       });

       router.post('/upload', upload.single('file'), async (req, res) => {
         try {
           const file = req.file;
           const { owner_account_id } = req.body;

           if (!file || !owner_account_id) {
             return res.status(400).json({ error: 'File and owner_account_id required' });
           }

           // TODO: Verify authentication

           // Step 1: Encrypt file
           const key = await import('../lib/encryption.js').then(m => m.generateEncryptionKey());
           const { encrypted, nonce } = await encryptData(file.buffer, key);

           // Step 2: Upload encrypted data to IPFS
           const encryptedBuffer = Buffer.from(encrypted, 'base64');
           const { cid, size } = await uploadToIPFS(encryptedBuffer, `${file.originalname}.encrypted`);

           // Step 3: Store metadata (will integrate with PostgreSQL in next task)
           console.log(`Document uploaded: ${cid}, size: ${size}`);

           res.json({
             cid,
             size,
             encrypted_key: key,
             nonce,
             message: 'Document uploaded and encrypted'
           });
         } catch (error: any) {
           console.error('Upload failed:', error);
           res.status(500).json({ error: error.message });
         }
       });

       export default router;
       ```

    3. Install multer:
       ```bash
       cd backend
       pnpm add multer
       pnpm add -D @types/multer
       ```

    4. Update backend/src/index.ts:
       ```typescript
       import documentsRouter from './api/documents.js';

       app.use('/api/documents', documentsRouter);
       ```

    5. Update frontend/src/lib/ipfs.ts (remove upload, keep reads):
       ```typescript
       const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';
       const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY!;

       // REMOVED: uploadFile() - now in backend

       export async function uploadDocument(
         file: File,
         ownerAccountId: string
       ): Promise<{ cid: string; encrypted_key: string; nonce: string }> {
         const formData = new FormData();
         formData.append('file', file);
         formData.append('owner_account_id', ownerAccountId);

         const response = await fetch(`${BACKEND_URL}/api/documents/upload`, {
           method: 'POST',
           body: formData
         });

         if (!response.ok) {
           throw new Error('Upload failed');
         }

         return response.json();
       }

       export async function retrieveFromIPFS(cid: string): Promise<Blob> {
         const response = await fetch(`${PINATA_GATEWAY}/ipfs/${cid}`);
         return response.blob();
       }
       ```

    Security improvement: Pinata JWT never exposed to browser, all uploads authenticated and encrypted server-side.

    Don't hand-roll: File upload handling (use multer), form data (use form-data), HTTP requests (use axios).
  </action>
  <verify>
    - curl -F "file=@test.txt" -F "owner_account_id=test.testnet" http://localhost:3001/api/documents/upload
    - Verify returns { cid, size, encrypted_key, nonce }
    - Verify file uploaded to IPFS (check Pinata dashboard)
    - Frontend uploadDocument() successfully calls backend
    - No PINATA_JWT in frontend code or .env.local
  </verify>
  <done>IPFS uploads moved to backend; Pinata JWT secured server-side; complete upload workflow: encrypt → IPFS; multer handling file uploads; frontend calls backend API; no IPFS credentials in browser</done>
</task>

<task type="auto">
  <name>Task 4: Remove all secrets from frontend environment</name>
  <files>frontend/.env.local, backend/.env, tests/security/frontend-no-secrets.test.ts</files>
  <action>
    Clean up frontend, move all secrets to backend, and verify security:

    1. Update frontend/.env.local (REMOVE ALL SECRETS):
       ```bash
       # ✅ PUBLIC CONFIGURATION ONLY

       # Privy authentication (public app ID)
       VITE_PRIVY_APP_ID=cmka26ryk00t1k00br9fufiwk

       # NEAR network (public config)
       VITE_NEAR_NETWORK=testnet

       # Backend API endpoint
       VITE_BACKEND_API_URL=http://localhost:3001

       # IPFS public gateway (read-only)
       VITE_PINATA_GATEWAY=https://coffee-kind-eagle-207.mypinata.cloud

       # ❌ REMOVED - MOVED TO BACKEND:
       # VITE_PINATA_JWT (now in backend/.env)
       # VITE_FASTNEAR_API_KEY (now in backend/.env)
       ```

    2. Verify backend/.env has all secrets:
       ```bash
       # Verify secrets moved
       grep PINATA_JWT backend/.env
       grep FASTNEAR_API_KEY backend/.env
       grep ENCRYPTION_MASTER_KEY backend/.env
       ```

    3. Create tests/security/frontend-no-secrets.test.ts:
       ```typescript
       import { describe, it, expect } from 'vitest';

       describe('Frontend Security', () => {
         it('should not expose secrets in environment', () => {
           const env = import.meta.env;

           // ❌ Secrets that MUST NOT exist
           expect(env.VITE_PINATA_JWT).toBeUndefined();
           expect(env.VITE_FASTNEAR_API_KEY).toBeUndefined();
           expect(env.PINATA_JWT).toBeUndefined();
           expect(env.DATABASE_URL).toBeUndefined();
           expect(env.ENCRYPTION_MASTER_KEY).toBeUndefined();

           // ✅ Public config that CAN exist
           expect(env.VITE_PRIVY_APP_ID).toBeDefined();
           expect(env.VITE_NEAR_NETWORK).toBeDefined();
           expect(env.VITE_BACKEND_API_URL).toBeDefined();
         });
       });
       ```

    4. Add test script to frontend/package.json:
       ```json
       {
         "scripts": {
           "test:security": "vitest run tests/security/"
         }
       }
       ```

    5. Run security test:
       ```bash
       cd frontend
       pnpm test:security
       ```

    6. Manual browser verification:
       ```bash
       # Start frontend
       pnpm dev

       # Open browser console and run:
       console.log(import.meta.env);

       # Should show ONLY public vars, no JWT or API keys
       ```

    7. Update SECURITY-MIGRATION-TRACKER.md:
       - Mark Plan 1-03 status as "✅ MIGRATED"
       - Check success criteria boxes
       - Note Phase 1-04 completion

    Critical: If PINATA_JWT was ever committed to git, ROTATE IT IMMEDIATELY (generate new JWT in Pinata dashboard).

    Don't hand-roll: Environment variable handling (use Vite's import.meta.env), security testing (use vitest).
  </action>
  <verify>
    - frontend/.env.local has no VITE_PINATA_JWT or VITE_FASTNEAR_API_KEY
    - backend/.env contains all secrets
    - pnpm test:security passes
    - Browser console shows no secrets in import.meta.env
    - git log search finds no committed secrets (or rotated if found)
    - SECURITY-MIGRATION-TRACKER updated
  </verify>
  <done>All secrets removed from frontend; backend .env contains all secrets; security test passing; browser environment clean; SECURITY-MIGRATION-TRACKER updated; Verifiable Zero Trust architecture restored</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Backend Express server running on port 3001
- [ ] Health endpoint responding (GET /health returns 200)
- [ ] Encryption API functional (POST /api/encryption/encrypt works)
- [ ] IPFS upload API functional (POST /api/documents/upload works)
- [ ] All secrets moved from frontend/.env.local to backend/.env
- [ ] Frontend .env.local contains only public config
- [ ] Security test passes (tests/security/frontend-no-secrets.test.ts)
- [ ] Browser console shows no secrets in import.meta.env
- [ ] Backend .env is in .gitignore
- [ ] SECURITY-MIGRATION-TRACKER updated with completion status
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from backend startup
- Backend API operational with sealed secrets
- All encryption operations moved to backend
- All IPFS uploads moved to backend
- Frontend has zero secrets (only public config)
- Security tests passing
- No secrets in git history (or rotated if found)
- SECURITY-MIGRATION-TRACKER confirms migration complete
- Verifiable Zero Trust architecture restored
- Ready for Phase 1-05 (Phala TEE integration)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-04-SUMMARY.md`:

# Phase 1 Plan 4: Backend Security Migration Summary

**CRITICAL security fix - Moved all sensitive operations from frontend to secure backend API**

## Accomplishments

- Node.js/Express backend with TypeScript operational on port 3001
- Sealed secrets management (backend/.env, never committed)
- All encryption operations moved to backend (crypto.randomBytes)
- All IPFS uploads moved to backend (Pinata JWT secured)
- Complete upload workflow: file → encrypt → IPFS (server-side)
- Frontend cleaned of all secrets (only public config remains)
- Security test suite implemented and passing
- SECURITY-MIGRATION-TRACKER updated with completion status

## Files Created/Modified

- `backend/package.json` - Backend dependencies (Express, axios, @noble/ciphers)
- `backend/tsconfig.json` - TypeScript configuration
- `backend/src/index.ts` - Express server with health endpoint
- `backend/src/lib/encryption.ts` - Server-side encryption (XChaCha20-Poly1305)
- `backend/src/lib/ipfs.ts` - Server-side IPFS client (Pinata)
- `backend/src/api/encryption.ts` - Encryption REST API
- `backend/src/api/documents.ts` - Document upload API
- `backend/.env` - Sealed secrets (PINATA_JWT, FASTNEAR_API_KEY, etc.)
- `backend/.env.example` - Public template
- `frontend/.env.local` - Updated (secrets removed, only public config)
- `frontend/src/lib/encryption.ts` - Updated (proxies to backend)
- `frontend/src/lib/ipfs.ts` - Updated (upload removed, only reads)
- `tests/security/frontend-no-secrets.test.ts` - Security test suite
- `.gitignore` - Updated (backend/.env excluded)
- `SECURITY-MIGRATION-TRACKER.md` - Updated (migration complete)

## Decisions Made

- Phase 1-04: Immediate security fix with standard Node.js backend
- Phase 1-05: Future Phala TEE integration for hardware attestation
- This approach unblocks development while TEE setup is in progress
- XChaCha20-Poly1305 encryption (industry standard, fast, secure)
- Server-side key generation with crypto.randomBytes (better entropy)
- Multer for file uploads (battle-tested, secure)
- All APIs designed to be TEE-compatible (drop-in replacement in Phase 1-05)

## Security Issues Resolved

**Before Plan 1-04:**
- ❌ IPFS client in frontend with exposed Pinata JWT
- ❌ Encryption keys generated in browser
- ❌ VITE_PINATA_JWT and VITE_FASTNEAR_API_KEY in frontend/.env.local

**After Plan 1-04:**
- ✅ IPFS uploads in backend with sealed Pinata JWT
- ✅ Encryption in backend with server-side key generation
- ✅ Frontend has zero secrets (only public config)
- ✅ Security tests passing
- ✅ Verifiable Zero Trust architecture restored

## Next Steps

1. **Implement Plan 1-03A**: PostgreSQL integration (dual-write pattern)
2. **Phase 1-05**: Phala TEE migration (hardware attestation, remote attestation)
3. **Phase 2**: Identity & RBAC (builds on secure backend)
4. **Phase 3**: ABAC policy engine (enforced in backend/TEE)

**Critical vulnerability fixed - Development can proceed securely.**

## Production Notes

- Generate new ENCRYPTION_MASTER_KEY for production: `openssl rand -hex 32`
- Rotate PINATA_JWT if ever committed to git (check: `git log --all -S 'PINATA_JWT'`)
- Backend ready for Phala TEE deployment (Phase 1-05)
- All APIs designed to be wrapped in TEE attestation
- Security tests must pass in CI/CD before deployment
</output>
