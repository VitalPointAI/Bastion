import { usePrivy, useWallets } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

interface AuthWrapperProps {
  children: ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  // Find NEAR wallet (embedded wallet created by Privy)
  const nearWallet = wallets.find(wallet => wallet.walletClientType === 'privy')

  // Log wallet information to console for verification
  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      console.log('=== BASTION Authentication Status ===')
      console.log('User authenticated:', authenticated)
      console.log('User info:', user)
      console.log('All wallets:', wallets)
      console.log('NEAR wallet:', nearWallet)
      console.log('NEAR wallet address:', nearWallet?.address)
      console.log('====================================')
    }
  }, [authenticated, wallets, user, nearWallet])

  return (
    <div className="auth-wrapper">
      {authenticated ? (
        <div className="auth-status">
          <div className="user-info">
            <p>Logged in as: {user?.email?.address || user?.google?.email || user?.twitter?.username || 'User'}</p>
            {nearWallet && (
              <p className="wallet-info">Account: {nearWallet.address}</p>
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
