import { useState } from 'react'
import { AuthWrapper } from './components/AuthWrapper'
import { LoginButton } from './components/LoginButton'
import { DAODashboard } from './components/dao'
import './App.css'

type View = 'home' | 'governance'

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
        </AuthWrapper>
      </main>
    </div>
  )
}

export default App
