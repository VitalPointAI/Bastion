import { usePrivy, useWallets } from '@privy-io/react-auth'
import type { ReactNode } from 'react'

interface AuthWrapperProps {
  children: ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { authenticated, user } = usePrivy()
  const { wallets } = useWallets()

  // Find NEAR wallet (embedded wallet created by Privy)
  const nearWallet = wallets.find(wallet => wallet.walletClientType === 'privy')

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
