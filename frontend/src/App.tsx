import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthWrapper } from './components/AuthWrapper'
import { LoginButton } from './components/LoginButton'
import { UserStatusBar } from './components/UserStatusBar'
import { DAODashboard } from './components/dao'
import { StrategicDashboard } from './components/strategic'
import { StrategicValidityDashboard } from './components/validity'
import { AdminDashboard } from './components/admin'
import { MissionList, MissionDetail, MissionWizard } from './components/mission'
import { LoginPage } from './components/LoginPage'
import { RegisterPage } from './components/RegisterPage'
import { MagicLinkVerify } from './components/MagicLinkVerify'
import { useUser } from './context/UserContext'
import './App.css'

type View = 'home' | 'governance' | 'strategic' | 'validity' | 'admin' | 'missions' | 'mission-detail' | 'mission-wizard'

function NotFound() {
  return (
    <div className="content-container">
      <h2>404 - Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">Return to Home</a>
    </div>
  )
}

interface AppContentProps {
  initialView?: View
}

function AppContent({ initialView }: AppContentProps = {}) {
  const [currentView, setCurrentView] = useState<View>(initialView || 'home')
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const { userDID } = useUser()

  return (
      <div className="app">
        <header className="app-header">
          <h1 onClick={() => setCurrentView('home')} style={{ cursor: 'pointer' }}>BASTION</h1>
          <nav className="app-nav">
            <button
              className={`nav-button ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentView('home')}
            >
              Home
            </button>
            <button
              className={`nav-button ${currentView === 'governance' ? 'active' : ''}`}
              onClick={() => setCurrentView('governance')}
            >
              Governance
            </button>
            <button
              className={`nav-button ${currentView === 'strategic' ? 'active' : ''}`}
              onClick={() => setCurrentView('strategic')}
            >
              Strategic
            </button>
            <button
              className={`nav-button ${currentView === 'validity' ? 'active' : ''}`}
              onClick={() => setCurrentView('validity')}
            >
              Validity
            </button>
            <button
              className={`nav-button ${currentView === 'missions' || currentView === 'mission-detail' || currentView === 'mission-wizard' ? 'active' : ''}`}
              onClick={() => setCurrentView('missions')}
            >
              Missions
            </button>
            <button
              className={`nav-button nav-button--admin ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentView('admin')}
            >
              Admin
            </button>
          </nav>
          <UserStatusBar />
        </header>
        <main className="app-main">
          {currentView === 'home' && (
            <div className="content-container">
              <h2>Welcome to BASTION</h2>
              <p>Login to access your command center</p>
              <div className="login-container">
                <LoginButton />
              </div>
            </div>
          )}
          {currentView === 'governance' && (
            <DAODashboard />
          )}
          {currentView === 'strategic' && (
            <StrategicDashboard />
          )}
          {currentView === 'validity' && (
            <StrategicValidityDashboard />
          )}
          {currentView === 'admin' && (
            <AdminDashboard onBack={() => setCurrentView('home')} />
          )}
          {currentView === 'missions' && (
            <MissionList
              onSelectMission={(id) => {
                setSelectedMissionId(id);
                setCurrentView('mission-detail');
              }}
              onCreateMission={() => setCurrentView('mission-wizard')}
            />
          )}
          {currentView === 'mission-detail' && selectedMissionId && (
            <MissionDetail
              missionId={selectedMissionId}
              onBack={() => setCurrentView('missions')}
            />
          )}
          {currentView === 'mission-wizard' && userDID && (
            <MissionWizard
              userDID={userDID}
              onClose={() => setCurrentView('missions')}
              onMissionCreated={(id) => {
                setSelectedMissionId(id);
                setCurrentView('mission-detail');
              }}
            />
          )}
        </main>
      </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Auth routes - outside AuthWrapper */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/verify" element={<MagicLinkVerify />} />
      <Route path="/auth/recover" element={<LoginPage />} /> {/* Recovery starts at login */}

      {/* Main app routes - protected by AuthWrapper */}
      <Route path="/" element={
        <AuthWrapper>
          <AppContent />
        </AuthWrapper>
      } />
      <Route path="/governance" element={
        <AuthWrapper>
          <AppContent initialView="governance" />
        </AuthWrapper>
      } />
      <Route path="/strategic" element={
        <AuthWrapper>
          <AppContent initialView="strategic" />
        </AuthWrapper>
      } />
      <Route path="/validity" element={
        <AuthWrapper>
          <AppContent initialView="validity" />
        </AuthWrapper>
      } />
      <Route path="/missions" element={
        <AuthWrapper>
          <AppContent initialView="missions" />
        </AuthWrapper>
      } />
      <Route path="/admin/*" element={
        <AuthWrapper>
          <AppContent initialView="admin" />
        </AuthWrapper>
      } />

      {/* 404 catch-all - must be last */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
