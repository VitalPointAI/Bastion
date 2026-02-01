import { useAuth } from '../hooks/useAuth'
import './LoginButton.css'

export function LoginButton() {
  const { isAuthenticated, login, logout } = useAuth()

  if (isAuthenticated) {
    return (
      <button className="logout-button" onClick={logout}>
        Logout
      </button>
    )
  }

  return (
    <button className="login-button" onClick={login}>
      Login
    </button>
  )
}
