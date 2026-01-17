---
phase: 04-strategic-planning-module
plan: 09
type: execute
domain: frontend
---

<objective>
Create frontend components for strategic planning document management, objective review, and approval workflows.

Purpose: Enable commanders and staff to upload documents, review extracted objectives, manage approval workflows, and view risk assessments through the command-center UI.
Output: Strategic planning dashboard with document upload, objective list, review interface, and risk visualization.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-strategic-planning-module/4-RESEARCH.md

# Prior phase context
@.planning/phases/03-dao-governance/3-07-SUMMARY.md
@.planning/phases/03-dao-governance/3-07-FIX-SUMMARY.md

# Relevant source files
@frontend/src/App.tsx
@frontend/src/components/dao/DashboardView.tsx
@frontend/src/styles/theme.css

**Established patterns:**
- [Phase 3-07]: Navigation without react-router (useState-based view switching)
- [Phase 3-07]: TypeScript erasableSyntaxOnly (const objects instead of enums)
- [Phase 3-07-FIX]: CSS custom properties for consistent theming
- [Phase 3-07-FIX]: Command-center grade dashboard styling
- [Phase 3-08]: CopilotPanel for AI-assisted analysis

**UI patterns from Phase 3:**
- Classification badges: UNCLASS (green), SECRET (amber), TOPSECRET (red with glow)
- Action-required badges for pending items
- Grid layouts with card components
- Collapsible panels for detail views
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create strategic planning service and types</name>
  <files>frontend/src/lib/strategic-service.ts, frontend/src/lib/types/strategic.ts</files>
  <action>
In frontend/src/lib/types/strategic.ts, define frontend types:

```typescript
// Strategic Document
export interface StrategicDocument {
  id: string;
  title: string;
  level: DocumentLevel;
  originalFilename: string;
  mimeType: string;
  pageCount?: number;
  textLength: number;
  classification: string;
  createdBy: string;
  createdAt: string;
  objectiveCount?: number;
}

export const DocumentLevel = {
  NSS: 'NSS',
  NDS: 'NDS',
  NMS: 'NMS',
  GEF: 'GEF',
  JSCP: 'JSCP',
  CAMPAIGN_PLAN: 'CAMPAIGN_PLAN',
  OTHER: 'OTHER',
} as const;
export type DocumentLevel = typeof DocumentLevel[keyof typeof DocumentLevel];

// Strategic Objective
export interface StrategicObjective {
  id: string;
  documentId: string;
  description: string;
  ends: { description: string; conditions: string[]; timeframe?: string };
  ways: { strategies: string[]; concepts: string[]; keyTasks: string[] };
  means: { forces: string[]; capabilities: string[]; resources: string[] };
  primaryInstrument: DIMEInstrument;
  supportingInstruments: DIMEInstrument[];
  priority: Priority;
  constraints: string[];
  assumptions: string[];
  status: ObjectiveStatus;
  extractedBy: 'HUMAN' | 'AI';
  extractionConfidence?: number;
  humanVerified: boolean;
}

export const DIMEInstrument = {
  DIPLOMATIC: 'DIPLOMATIC',
  INFORMATIONAL: 'INFORMATIONAL',
  MILITARY: 'MILITARY',
  ECONOMIC: 'ECONOMIC',
} as const;
export type DIMEInstrument = typeof DIMEInstrument[keyof typeof DIMEInstrument];

export const Priority = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' } as const;
export type Priority = typeof Priority[keyof typeof Priority];

export const ObjectiveStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  OPERATIONALIZED: 'OPERATIONALIZED',
} as const;
export type ObjectiveStatus = typeof ObjectiveStatus[keyof typeof ObjectiveStatus];

// Workflow
export interface WorkflowStatus {
  state: string;
  objectiveId: string;
  currentReviewer?: string;
  approvalCount: number;
  reviewerCount: number;
  history: WorkflowEvent[];
}

export interface WorkflowEvent {
  type: string;
  actorId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// Risk Assessment
export interface RiskAssessment {
  id: string;
  objectiveId: string;
  riskToMission: RiskDimension;
  riskToForce: RiskDimension;
  residualRisk: RiskLevel;
  mitigations: Mitigation[];
  assessedBy: string;
  assessedAt: string;
  reviewedBy?: string;
}

export interface RiskDimension {
  likelihood: Likelihood;
  impact: Impact;
  riskLevel: RiskLevel;
  factors: string[];
}

export const RiskLevel = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', EXTREME: 'EXTREME' } as const;
export type RiskLevel = typeof RiskLevel[keyof typeof RiskLevel];

// Similar for Likelihood, Impact, Mitigation
```

In frontend/src/lib/strategic-service.ts:

```typescript
const API_BASE = '/api/strategic';

export const strategicService = {
  // Documents
  async uploadDocument(file: File, title: string, level: string, classification: string): Promise<StrategicDocument> {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title);
    formData.append('level', level);
    formData.append('classification', classification);

    const response = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: { 'X-DID': getDID() },
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  async getDocuments(): Promise<StrategicDocument[]> { /* ... */ },
  async getDocument(id: string): Promise<StrategicDocument> { /* ... */ },

  // Extraction
  async extractObjectives(documentId: string): Promise<{ objectiveCount: number; objectives: StrategicObjective[] }> { /* ... */ },

  // Objectives
  async getObjectives(filters?: { status?: string; documentId?: string }): Promise<StrategicObjective[]> { /* ... */ },
  async getObjective(id: string): Promise<StrategicObjective> { /* ... */ },
  async updateObjective(id: string, updates: Partial<StrategicObjective>): Promise<StrategicObjective> { /* ... */ },
  async verifyObjective(id: string, verified: boolean): Promise<void> { /* ... */ },

  // Workflow
  async submitForApproval(objectiveId: string, reviewers: string[]): Promise<WorkflowStatus> { /* ... */ },
  async submitReview(objectiveId: string, decision: string, comment?: string): Promise<WorkflowStatus> { /* ... */ },
  async getWorkflowStatus(objectiveId: string): Promise<WorkflowStatus> { /* ... */ },

  // Risk
  async generateRiskAssessment(objectiveId: string): Promise<RiskAssessment> { /* ... */ },
  async getRiskAssessments(objectiveId: string): Promise<RiskAssessment[]> { /* ... */ },
};
```

Helper functions for DID retrieval from auth context.
  </action>
  <verify>
```bash
cd frontend && npx tsc --noEmit src/lib/strategic-service.ts
```
  </verify>
  <done>
- Strategic types defined with const objects (not enums)
- StrategicDocument, StrategicObjective, WorkflowStatus, RiskAssessment types
- strategicService with API methods for all operations
- File upload support for documents
  </done>
</task>

<task type="auto">
  <name>Task 2: Create document upload and list components</name>
  <files>frontend/src/components/strategic/DocumentUpload.tsx, frontend/src/components/strategic/DocumentList.tsx, frontend/src/components/strategic/DocumentUpload.css, frontend/src/components/strategic/DocumentList.css</files>
  <action>
Create frontend/src/components/strategic/ directory.

In DocumentUpload.tsx:
Create document upload component with:
- File drop zone (drag and drop support)
- File input fallback
- Title input field
- Document level selector (dropdown with NSS, NDS, etc.)
- Classification selector (UNCLASSIFIED, SECRET, TOPSECRET)
- Upload progress indicator
- Success/error feedback

```tsx
export function DocumentUpload({ onUploadComplete }: { onUploadComplete?: (doc: StrategicDocument) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<DocumentLevel>('OTHER');
  const [classification, setClassification] = useState('UNCLASSIFIED');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => { /* ... */ };
  const handleUpload = async () => { /* ... */ };

  return (
    <div className="document-upload">
      <div className="upload-dropzone" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {file ? (
          <div className="file-preview">
            <span className="file-name">{file.name}</span>
            <span className="file-size">{formatFileSize(file.size)}</span>
          </div>
        ) : (
          <div className="drop-prompt">
            <span>Drop PDF or DOCX file here</span>
            <input type="file" accept=".pdf,.docx,.doc" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
        )}
      </div>

      <div className="upload-form">
        <input type="text" placeholder="Document title" value={title} onChange={e => setTitle(e.target.value)} />

        <select value={level} onChange={e => setLevel(e.target.value as DocumentLevel)}>
          {Object.values(DocumentLevel).map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select value={classification} onChange={e => setClassification(e.target.value)}>
          <option value="UNCLASSIFIED">UNCLASSIFIED</option>
          <option value="SECRET">SECRET</option>
          <option value="TOPSECRET">TOPSECRET</option>
        </select>

        <button onClick={handleUpload} disabled={!file || !title || uploading}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}
```

In DocumentList.tsx:
Create document list with:
- Grid of document cards
- Document level badge
- Classification badge (styled per Phase 3 patterns)
- Page count, text length metadata
- "Extract Objectives" button (triggers extraction)
- Click to view document details

CSS files should follow command-center theme from Phase 3-07-FIX:
- Dark background with subtle grid overlay
- Card borders with glow effects
- Classification badge styling (green/amber/red)
  </action>
  <verify>
```bash
cd frontend && npx tsc --noEmit src/components/strategic/DocumentUpload.tsx src/components/strategic/DocumentList.tsx
```
  </verify>
  <done>
- DocumentUpload with drag-and-drop
- Document level and classification selectors
- Upload progress and error handling
- DocumentList with grid layout
- Classification badges styled per theme
- Extract Objectives button on each document
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Strategic planning document upload and list UI</what-built>
  <how-to-verify>
    1. Run: cd frontend && pnpm dev
    2. Navigate to Strategic Planning section (add nav link if needed)
    3. Test document upload:
       - Drag and drop a PDF file
       - Fill in title, select level and classification
       - Click Upload
    4. Verify document appears in list
    5. Check classification badge styling (UNCLASS=green, SECRET=amber, TOPSECRET=red)
    6. Click "Extract Objectives" button (should trigger extraction)
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd frontend && pnpm build` succeeds without TypeScript errors
- [ ] Document upload component accepts files
- [ ] Document list displays uploaded documents
- [ ] Classification badges match Phase 3 styling
- [ ] Navigation to strategic section works
</verification>

<success_criteria>

- Strategic service with API integration
- Document upload with drag-and-drop
- Document list with metadata display
- Classification badge styling
- Extraction trigger button
- Command-center theme consistency
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-09-SUMMARY.md`
</output>
