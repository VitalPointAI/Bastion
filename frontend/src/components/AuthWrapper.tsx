import { usePrivy, useWallets } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

interface AuthWrapperProps {
  children: ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { authenticated, user } = usePrivy()
  const { wallets, ready } = useWallets()

  // Find embedded wallet (created automatically by Privy)
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy')

  // Log wallet information to console for verification
  useEffect(() => {
    console.log('=== BASTION Authentication Debug ===')
    console.log('Authenticated:', authenticated)
    console.log('Wallets ready:', ready)
    console.log('Wallets length:', wallets.length)
    console.log('All wallets:', wallets)
    console.log('User object:', user)

    if (authenticated) {
      console.log('✅ User is authenticated')
      if (wallets.length > 0) {
        console.log('✅ Wallets found:', wallets.length)
        console.log('Wallet details:', JSON.stringify(wallets, null, 2))
        console.log('Embedded wallet:', embeddedWallet)
        if (embeddedWallet) {
          console.log('✅ Embedded wallet address:', embeddedWallet.address)
        } else {
          console.log('⚠️ No embedded wallet found in wallets array')
        }
      } else {
        console.log('⚠️ No wallets created yet')
      }
    } else {
      console.log('❌ User not authenticated')
    }
    console.log('====================================')
  }, [authenticated, ready, wallets, user, embeddedWallet])

  return (
    <div className="auth-wrapper">
      {authenticated ? (
        <div className="auth-status">
          <div className="user-info">
            <p>Logged in as: {user?.email?.address || user?.google?.email || user?.twitter?.username || 'User'}</p>
            {embeddedWallet && (
              <p className="wallet-info">Account: {embeddedWallet.address}</p>
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
