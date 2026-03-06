import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AnonAuthProvider } from '@vitalpoint/near-phantom-auth/client'
import { AuthWrapper } from './components/AuthWrapper'
import { UserStatusBar } from './components/UserStatusBar'
import { AdminDashboard } from './components/admin'
import { LoginPage } from './components/LoginPage'
import { RegisterPage } from './components/RegisterPage'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { ModeProvider } from './context/ModeContext'
import { WorkspaceSwitcher } from './components/workspace/WorkspaceSwitcher'
import { WorkspaceSelector } from './components/workspace/WorkspaceSelector'
import { WorkspaceBreadcrumb } from './components/workspace/WorkspaceBreadcrumb'
import { InviteAcceptPage } from './components/workspace/InviteAcceptPage'
import { WorkspaceTabContainer } from './components/workspace/WorkspaceTabContainer'
import { WorkspaceMemberManager } from './components/workspace/WorkspaceMemberManager'
import { MemberDirectory } from './components/workspace/MemberDirectory'
import './App.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';

function NotFound() {
  return (
    <div className="content-container">
      <h2>404 - Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">Return to Home</a>
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

  const isAdmin = location.pathname.startsWith('/admin');
  const isWorkspace = location.pathname.startsWith('/workspace');

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>BASTION</h1>
        <nav className="app-nav">
          <WorkspaceBreadcrumb />
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
          <AdminDashboard onBack={() => navigate('/')} />
        ) : isWorkspace ? (
          <Routes>
            <Route path="invite/:token" element={<InviteAcceptPage />} />
            {/* Specific sub-routes must come before /:tab catch-all */}
            <Route path=":workspaceId/members" element={<WorkspaceMemberManagerPage />} />
            <Route path=":workspaceId/directory" element={<MemberDirectoryPage />} />
            <Route path=":workspaceId/invite" element={<WorkspacePlaceholder label="Invite" />} />
            <Route path=":workspaceId/settings" element={<WorkspacePlaceholder label="Settings" />} />
            {/* Tab-aware routes — WorkspaceTabContainer reads :tab param for URL-driven tab state */}
            <Route path=":workspaceId/:tab" element={<WorkspaceTabContainer />} />
            <Route path=":workspaceId" element={<WorkspaceTabContainer />} />
          </Routes>
        ) : (
          <WorkspaceSelector />
        )}
      </main>
    </div>
  )
}

// ─── Authenticated shell with WorkspaceProvider ──────────────────────────────

function AuthenticatedShell() {
  return (
    <ModeProvider>
      <WorkspaceProvider>
        <AppContent />
      </WorkspaceProvider>
    </ModeProvider>
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

        {/* Root route — workspace selector landing page */}
        <Route path="/" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />

        {/* Legacy redirects — old panel URLs redirect to workspace selector */}
        <Route path="/decide" element={<Navigate to="/" replace />} />
        <Route path="/design" element={<Navigate to="/" replace />} />
        <Route path="/campaign" element={<Navigate to="/" replace />} />
        <Route path="/monitor" element={<Navigate to="/" replace />} />
        <Route path="/exercise" element={<Navigate to="/" replace />} />

        {/* Older legacy redirects */}
        <Route path="/governance" element={<Navigate to="/" replace />} />
        <Route path="/strategic" element={<Navigate to="/" replace />} />
        <Route path="/validity" element={<Navigate to="/" replace />} />
        <Route path="/missions" element={<Navigate to="/" replace />} />

        {/* Admin routes - protected by AuthWrapper + WorkspaceProvider */}
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
