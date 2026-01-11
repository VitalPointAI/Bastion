import { AuthWrapper } from './components/AuthWrapper'
import { LoginButton } from './components/LoginButton'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>BASTION</h1>
      </header>
      <main className="app-main">
        <AuthWrapper>
          <div className="content-container">
            <h2>Welcome to BASTION</h2>
            <p>Login to access your command center</p>
            <div className="login-container">
              <LoginButton />
            </div>
          </div>
        </AuthWrapper>
      </main>
    </div>
  )
}

export default App
