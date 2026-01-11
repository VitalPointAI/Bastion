import { AuthWrapper } from './components/AuthWrapper'
import { LoginButton } from './components/LoginButton'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Coalition Operations Platform</h1>
      </header>
      <main className="app-main">
        <AuthWrapper>
          <div className="content-container">
            <h2>Welcome to Coalition Operations</h2>
            <p>Login to access the platform</p>
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
