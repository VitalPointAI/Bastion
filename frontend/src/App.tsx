import { useState } from 'react'
import { AuthWrapper } from './components/AuthWrapper'
import { LoginButton } from './components/LoginButton'
import { DAODashboard } from './components/dao'
import { StrategicDashboard } from './components/strategic'
import { AdminDashboard } from './components/admin'
import './App.css'

type View = 'home' | 'governance' | 'strategic' | 'admin'

function App() {
  const [currentView, setCurrentView] = useState<View>('home')

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
            className={`nav-button nav-button--admin ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentView('admin')}
          >
            Admin
          </button>
        </nav>
      </header>
      <main className="app-main">
        <AuthWrapper>
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
          {currentView === 'admin' && (
            <AdminDashboard onBack={() => setCurrentView('home')} />
          )}
        </AuthWrapper>
      </main>
    </div>
  )
}

export default App
