import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { AnonAuthProvider } from '@vitalpoint/near-phantom-auth/client'
import { AuthWrapper } from './components/AuthWrapper'
import { UserStatusBar } from './components/UserStatusBar'
import { AdminDashboard } from './components/admin'
import { LoginPage } from './components/LoginPage'
import { RegisterPage } from './components/RegisterPage'
import { ProblemSetProvider } from './context/ProblemSetContext'
import { ModeProvider, useMode } from './context/ModeContext'
import { ExerciseBanner } from './components/ExerciseBanner'
import { ProblemSetSwitcher } from './components/problem-set/ProblemSetSwitcher'
import { ProblemSetSelector } from './components/problem-set/ProblemSetSelector'
import { ProblemSetBreadcrumb } from './components/problem-set/ProblemSetBreadcrumb'
import { InviteAcceptPage } from './components/problem-set/InviteAcceptPage'
import { ProblemSetTabContainer } from './components/problem-set/ProblemSetTabContainer'
import { ProblemSetMemberManager } from './components/problem-set/ProblemSetMemberManager'
import { MemberDirectory } from './components/problem-set/MemberDirectory'
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

function ProblemSetPlaceholder({ label }: { label: string }) {
  return (
    <div className="content-container" style={{ padding: '2rem' }}>
      <h2 style={{ color: '#f9fafb' }}>{label}</h2>
      <p style={{ color: '#9ca3af' }}>This section is coming soon.</p>
    </div>
  );
}

function ProblemSetMemberManagerPage() {
  const { problemSetId } = useParams<{ problemSetId: string }>();
  const navigate = useNavigate();
  if (!problemSetId) return <ProblemSetPlaceholder label="Members" />;
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/problem-set/${problemSetId}`)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back to Dashboard
        </button>
        <h2 className="text-lg font-semibold text-white">Manage Members</h2>
      </div>
      <ProblemSetMemberManager problemSetId={problemSetId} />
    </div>
  );
}

function MemberDirectoryPage() {
  const { problemSetId } = useParams<{ problemSetId: string }>();
  const navigate = useNavigate();
  if (!problemSetId) return <ProblemSetPlaceholder label="Directory" />;
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/problem-set/${problemSetId}`)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back to Dashboard
        </button>
        <h2 className="text-lg font-semibold text-white">Member Directory</h2>
      </div>
      <MemberDirectory problemSetId={problemSetId} />
    </div>
  );
}

// ─── Backward-compatibility redirect: /workspace/* -> /problem-set/* ─────────

function WorkspaceRedirect() {
  const location = useLocation();
  return <Navigate to={location.pathname.replace('/workspace', '/problem-set') + location.search} replace />;
}

// ─── AppContent ──────────────────────────────────────────────────────────────

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isTraining } = useMode();

  const isAdmin = location.pathname.startsWith('/admin');
  const isProblemSet = location.pathname.startsWith('/problem-set');

  return (
    <div className="app">
      {isTraining && <ExerciseBanner />}
      <header className="app-header">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>BASTION</h1>
        <nav className="app-nav">
          <ProblemSetBreadcrumb />
          <div className="nav-spacer" />
          <ProblemSetSwitcher />
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
        ) : isProblemSet ? (
          <Routes>
            <Route path="invite/:token" element={<InviteAcceptPage />} />
            {/* Specific sub-routes must come before /:tab catch-all */}
            <Route path=":problemSetId/members" element={<ProblemSetMemberManagerPage />} />
            <Route path=":problemSetId/directory" element={<MemberDirectoryPage />} />
            <Route path=":problemSetId/invite" element={<ProblemSetPlaceholder label="Invite" />} />
            <Route path=":problemSetId/settings" element={<ProblemSetPlaceholder label="Settings" />} />
            {/* Tab-aware routes — ProblemSetTabContainer reads :tab param for URL-driven tab state */}
            <Route path=":problemSetId/:tab" element={<ProblemSetTabContainer />} />
            <Route path=":problemSetId" element={<ProblemSetTabContainer />} />
          </Routes>
        ) : (
          <ProblemSetSelector />
        )}
      </main>
    </div>
  )
}

// ─── Authenticated shell with ProblemSetProvider ──────────────────────────────

function AuthenticatedShell() {
  return (
    <ModeProvider>
      <ProblemSetProvider>
        <AppContent />
      </ProblemSetProvider>
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

        {/* Root route — problem set selector landing page */}
        <Route path="/" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />

        {/* Legacy redirects — old panel URLs redirect to problem set selector */}
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

        {/* Admin routes - protected by AuthWrapper + ProblemSetProvider */}
        <Route path="/admin/*" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />

        {/* Problem set routes - protected by AuthWrapper + ProblemSetProvider */}
        <Route path="/problem-set/*" element={
          <AuthWrapper>
            <AuthenticatedShell />
          </AuthWrapper>
        } />

        {/* Backward-compat redirect: /workspace/* -> /problem-set/* */}
        <Route path="/workspace/*" element={<WorkspaceRedirect />} />

        {/* 404 catch-all - must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnonAuthProvider>
  )
}

export default App
