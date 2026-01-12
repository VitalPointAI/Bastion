import { usePrivy } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

interface AuthWrapperProps {
  children: ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { authenticated, user } = usePrivy()
  const [nearAccount, setNearAccount] = useState<string | null>(null)
  const [creatingWallet, setCreatingWallet] = useState(false)

  // Create NEAR account via backend MPC integration
  useEffect(() => {
    const initializeAccount = async () => {
      console.log('=== BASTION Authentication Debug ===')
      console.log('Authenticated:', authenticated)
      console.log('User:', user)

      if (authenticated && user && !nearAccount && !creatingWallet) {
        setCreatingWallet(true)

        try {
          // Get Privy access token for backend auth
          const privyUserId = user.id
          const email = user.email?.address || user.google?.email || user.twitter?.username || 'unknown'

          console.log('⚡ Creating NEAR account via backend MPC...')
          console.log('Privy User ID:', privyUserId)
          console.log('Email:', email)

          // Call backend to create NEAR account with MPC derivation
          const response = await fetch('http://localhost:3001/api/accounts/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              privyUserId,
              email,
              authToken: 'privy-jwt-token', // TODO: Get actual Privy JWT
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to create account: ${response.statusText}`)
          }

          const data = await response.json()
          console.log('✅ NEAR account created:', data.accountId)
          console.log('📍 MPC Derivation Path:', data.derivationPath)
          console.log('🔐 MPC Contract:', data.mpcContractId)
          console.log('====================================')

          setNearAccount(data.accountId)
        } catch (error) {
          console.error('❌ Failed to create NEAR account:', error)
        } finally {
          setCreatingWallet(false)
        }
      }
    }

    initializeAccount()
  }, [authenticated, user, nearAccount, creatingWallet])

  return (
    <div className="auth-wrapper">
      {authenticated ? (
        <div className="auth-status">
          <div className="user-info">
            <p>Logged in as: {user?.email?.address || user?.google?.email || user?.twitter?.username || 'User'}</p>
            {creatingWallet && (
              <p className="wallet-status">Setting up your account...</p>
            )}
            {nearAccount && (
              <p className="account-info">Account ID: {nearAccount}</p>
            )}
          </div>
          <div className="content">
            {children}
          </div>
        </div>
      ) : (
        <div className="auth-required">
          {children}
        </div>
      )}
    </div>
  )
}
