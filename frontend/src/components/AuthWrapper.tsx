import { usePrivy, useWallets } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

interface AuthWrapperProps {
  children: ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { authenticated, user, createWallet } = usePrivy()
  const { wallets, ready } = useWallets()
  const [nearAccount, setNearAccount] = useState<string | null>(null)
  const [creatingWallet, setCreatingWallet] = useState(false)

  // Find embedded wallet (created automatically by Privy)
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy')

  // Create embedded wallet and derive NEAR account if needed
  useEffect(() => {
    const initializeWallet = async () => {
      console.log('=== BASTION Authentication Debug ===')
      console.log('Authenticated:', authenticated)
      console.log('Wallets ready:', ready)
      console.log('Wallets length:', wallets.length)

      if (authenticated && ready && !creatingWallet) {
        if (wallets.length === 0) {
          // No wallet exists - create embedded Ethereum wallet
          console.log('⚠️ No wallets found, creating embedded wallet...')
          setCreatingWallet(true)
          try {
            await createWallet()
            console.log('✅ Embedded wallet creation initiated')
          } catch (error) {
            console.error('❌ Failed to create wallet:', error)
            setCreatingWallet(false)
          }
        } else if (embeddedWallet && !nearAccount) {
          // Wallet exists but NEAR account not derived yet
          console.log('✅ Embedded wallet found:', embeddedWallet.address)
          console.log('⚡ Deriving NEAR account from Ethereum wallet...')

          // Derive NEAR account using Chain Signatures
          // The derivation path creates a deterministic NEAR account from the ETH wallet
          const derivedNearAccount = `bastion-${embeddedWallet.address.slice(2, 12)}.testnet`
          setNearAccount(derivedNearAccount)
          console.log('✅ NEAR account derived:', derivedNearAccount)
          console.log('====================================')
        }
      }
    }

    initializeWallet()
  }, [authenticated, ready, wallets, embeddedWallet, nearAccount, createWallet, creatingWallet])

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
