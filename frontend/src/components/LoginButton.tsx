import { usePrivy } from '@privy-io/react-auth'
import './LoginButton.css'

export function LoginButton() {
  const { authenticated, login, logout } = usePrivy()

  if (authenticated) {
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
