import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
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

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={() => navigate('/monitor')} style={{ cursor: 'pointer' }}>BASTION</h1>
        <nav className="app-nav">
          <button
            className={`nav-button ${activeTab === 'decide' && !isAdmin && !isExercise ? 'active' : ''}`}
            onClick={() => navigate('/decide')}
          >
            Decide
          </button>
          <button
            className={`nav-button ${activeTab === 'design' && !isAdmin && !isExercise ? 'active' : ''}`}
            onClick={() => navigate('/design')}
          >
            Design
          </button>
          <button
            className={`nav-button ${activeTab === 'campaign' && !isAdmin && !isExercise ? 'active' : ''}`}
            onClick={() => navigate('/campaign')}
          >
            Campaign
          </button>
          <button
            className={`nav-button ${activeTab === 'monitor' && !isAdmin && !isExercise ? 'active' : ''}`}
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

        {/* Main app routes - protected by AuthWrapper */}
        <Route path="/decide" element={
          <AuthWrapper>
            <AppContent />
          </AuthWrapper>
        } />
        <Route path="/design" element={
          <AuthWrapper>
            <AppContent />
          </AuthWrapper>
        } />
        <Route path="/campaign" element={
          <AuthWrapper>
            <AppContent />
          </AuthWrapper>
        } />
        <Route path="/monitor" element={
          <AuthWrapper>
            <AppContent />
          </AuthWrapper>
        } />
        <Route path="/exercise" element={
          <AuthWrapper>
            <AppContent />
          </AuthWrapper>
        } />
        <Route path="/admin/*" element={
          <AuthWrapper>
            <AppContent />
          </AuthWrapper>
        } />

        {/* 404 catch-all - must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnonAuthProvider>
  )
}

export default App
