import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AnonAuthProvider } from '@vitalpoint/near-phantom-auth/client'
import { AuthWrapper } from './components/AuthWrapper'
import { UserStatusBar } from './components/UserStatusBar'
import { AdminDashboard } from './components/admin'
import { LoginPage } from './components/LoginPage'
import { RegisterPage } from './components/RegisterPage'
import { DecideTab } from './components/tabs/DecideTab'
import { DesignTab } from './components/tabs/DesignTab'
import { CampaignTab } from './components/tabs/CampaignTab'
import { MonitorTab } from './components/tabs/MonitorTab'
import { ExerciseDashboard } from './components/exercise'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { WorkspaceSwitcher } from './components/workspace/WorkspaceSwitcher'
import { InviteAcceptPage } from './components/workspace/InviteAcceptPage'
import { WorkspaceDashboard } from './components/workspace/WorkspaceDashboard'
import { WorkspaceMemberManager } from './components/workspace/WorkspaceMemberManager'
import { MemberDirectory } from './components/workspace/MemberDirectory'
import './App.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';

const MAIN_TABS = ['decide', 'design', 'campaign', 'monitor', 'exercise'] as const;
type MainTab = typeof MAIN_TABS[number];

function NotFound() {
  return (
    <div className="content-container">
      <h2>404 - Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/monitor">Return to Home</a>
    </div>
  )
}

function WorkspacePlaceholder({ label }: { label: string }) {
  return (
    <div className="content-container" style={{ padding: '2rem' }}>
      <h2 style={{ color: '#f9fafb' }}>{label}</h2>
      <p style={{ color: '#9ca3af' }}>This section is coming soon.</p>
    </div>
  );
}

function WorkspaceMemberManagerPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  if (!workspaceId) return <WorkspacePlaceholder label="Members" />;
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/workspace/${workspaceId}`)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back to Dashboard
        </button>
        <h2 className="text-lg font-semibold text-white">Manage Members</h2>
      </div>
      <WorkspaceMemberManager workspaceId={workspaceId} />
    </div>
  );
}

function MemberDirectoryPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  if (!workspaceId) return <WorkspacePlaceholder label="Directory" />;
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/workspace/${workspaceId}`)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back to Dashboard
        </button>
        <h2 className="text-lg font-semibold text-white">Member Directory</h2>
      </div>
      <MemberDirectory workspaceId={workspaceId} />
    </div>
  );
}

// ─── AppContent ──────────────────────────────────────────────────────────────

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from URL pathname
  const activeTab: MainTab = (() => {
    for (const tab of MAIN_TABS) {
      if (location.pathname.startsWith(`/${tab}`)) return tab;
    }
    return 'monitor';
  })();

  const isAdmin = location.pathname.startsWith('/admin');
  const isExercise = location.pathname.startsWith('/exercise');
  const isWorkspace = location.pathname.startsWith('/workspace');

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={() => navigate('/monitor')} style={{ cursor: 'pointer' }}>BASTION</h1>
        <nav className="app-nav">
          <button
            className={`nav-button ${activeTab === 'decide' && !isAdmin && !isExercise && !isWorkspace ? 'active' : ''}`}
            onClick={() => navigate('/decide')}
          >
            Decide
          </button>
          <button
            className={`nav-button ${activeTab === 'design' && !isAdmin && !isExercise && !isWorkspace ? 'active' : ''}`}
            onClick={() => navigate('/design')}
          >
            Design
          </button>
          <button
            className={`nav-button ${activeTab === 'campaign' && !isAdmin && !isExercise && !isWorkspace ? 'active' : ''}`}
            onClick={() => navigate('/campaign')}
          >
            Campaign
          </button>
          <button
            className={`nav-button ${activeTab === 'monitor' && !isAdmin && !isExercise && !isWorkspace ? 'active' : ''}`}
            onClick={() => navigate('/monitor')}
          >
            Monitor
          </button>
          <button
            className={`nav-button ${isExercise ? 'active' : ''}`}
            onClick={() => navigate('/exercise')}
          >
            Exercise
          </button>
          <div className="nav-spacer" />
          <WorkspaceSwitcher />
          <button
            className={`nav-button nav-button--admin ${isAdmin ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            Admin
          </button>
        </nav>
        <UserStatusBar />
      </header>

      <main className="app-main">
          {isAdmin ? (
            <AdminDashboard onBack={() => navigate('/monitor')} />
          ) : isExercise ? (
            <ExerciseDashboard />
          ) : isWorkspace ? (
            <Routes>
              <Route path="/workspace/invite/:token" element={<InviteAcceptPage />} />
              <Route path="/workspace/:workspaceId" element={<WorkspaceDashboard />} />
              <Route path="/workspace/:workspaceId/members" element={<WorkspaceMemberManagerPage />} />
              <Route path="/workspace/:workspaceId/directory" element={<MemberDirectoryPage />} />
              <Route path="/workspace/:workspaceId/invite" element={<WorkspacePlaceholder label="Invite" />} />
              <Route path="/workspace/:workspaceId/settings" element={<WorkspacePlaceholder label="Settings" />} />
            </Routes>
          ) : (
            <>
              {activeTab === 'decide' && <DecideTab />}
              {activeTab === 'design' && <DesignTab />}
              {activeTab === 'campaign' && <CampaignTab />}
              {activeTab === 'monitor' && <MonitorTab />}
            </>
          )}
        </main>
    </div>
  )
}

// ─── Authenticated shell with WorkspaceProvider ──────────────────────────────

function AuthenticatedShell() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  return (
    // AnonAuthProvider at top level — shared by auth pages and protected routes
    <AnonAuthProvider apiUrl={`${BACKEND_URL}/api/auth`}>
      <Routes>
        {/* Auth routes - outside AuthWrapper guard but inside AnonAuthProvider */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Legacy redirects - fire before auth check */}
        <Route path="/" element={<Navigate to="/monitor" replace />} />
        <Route path="/governance" element={<Navigate to="/decide" replace />} />
        <Route path="/strategic" element={<Navigate to="/design" replace />} />
        <Route path="/validity" element={<Navigate to="/monitor" replace />} />
        <Route path="/missions" element={<Navigate to="/campaign" replace />} />

        {/* Main app routes - protected by AuthWrapper + WorkspaceProvider */}
        <Route path="/decide" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />
        <Route path="/design" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />
        <Route path="/campaign" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />
        <Route path="/monitor" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />
        <Route path="/exercise" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />
        <Route path="/admin/*" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />

        {/* Workspace routes - protected by AuthWrapper + WorkspaceProvider */}
        <Route path="/workspace/*" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />

        {/* 404 catch-all - must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnonAuthProvider>
  )
}

export default App
