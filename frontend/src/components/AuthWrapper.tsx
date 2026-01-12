import { usePrivy } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { getMPCRecoveryManager } from '../lib/mpcRecovery'

interface AuthWrapperProps {
  children: ReactNode
}

interface AccountState {
  accountId: string
  derivationPath: string
  mpcRegistered: boolean
  mpcPublicKey?: string
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { authenticated, user } = usePrivy()
  const [accountState, setAccountState] = useState<AccountState | null>(null)
  const [status, setStatus] = useState<'idle' | 'creating' | 'registering-mpc' | 'ready' | 'error'>('idle')

  // Create NEAR account and register with MPC
  useEffect(() => {
    const initializeAccount = async () => {
      if (!authenticated || !user || accountState || status !== 'idle') {
        return
      }

      setStatus('creating')
      console.log('=== BASTION Account Initialization ===')
      console.log('User:', user.id)

      try {
        const privyUserId = user.id
        const email = user.email?.address || user.google?.email || user.twitter?.username || 'unknown'

        // Step 1: Create NEAR account via backend
        console.log('📝 Step 1: Creating NEAR account...')
        const response = await fetch('http://localhost:3001/api/accounts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyUserId,
            email,
            authToken: 'privy-jwt-token',
          }),
        })

        if (!response.ok) {
          throw new Error(`Account creation failed: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('✅ NEAR account created:', data.accountId)
        console.log('   On-chain:', data.onChain)
        console.log('   Derivation path:', data.derivationPath)

        // Step 2: Register with MPC for key backup
        setStatus('registering-mpc')
        console.log('🔐 Step 2: Registering with MPC for key backup...')

        const mpcManager = getMPCRecoveryManager('testnet')
        const mpcResult = await mpcManager.registerWithMPC(
          data.accountId,
          data.derivationPath,
          'http://localhost:3001',
          privyUserId
        )

        if (mpcResult.status === 'registered') {
          console.log('✅ MPC registration complete!')
          console.log('   MPC Public Key:', mpcResult.mpcPublicKey)
          console.log('   Recovery enabled via:', data.derivationPath)

          setAccountState({
            accountId: data.accountId,
            derivationPath: data.derivationPath,
            mpcRegistered: true,
            mpcPublicKey: mpcResult.mpcPublicKey,
          })
          setStatus('ready')
        } else {
          console.warn('⚠️ MPC registration pending - account functional but recovery not enabled')
          setAccountState({
            accountId: data.accountId,
            derivationPath: data.derivationPath,
            mpcRegistered: false,
          })
          setStatus('ready')
        }

        console.log('====================================')

      } catch (error) {
        console.error('❌ Account initialization failed:', error)
        setStatus('error')
      }
    }

    initializeAccount()
  }, [authenticated, user, accountState, status])

  // Get display status
  const getStatusMessage = () => {
    switch (status) {
      case 'creating':
        return 'Creating your account...'
      case 'registering-mpc':
        return 'Securing your account with MPC backup...'
      case 'error':
        return 'Account setup failed. Please try again.'
      default:
        return null
    }
  }

  const statusMessage = getStatusMessage()

  return (
    <div className="auth-wrapper">
      {authenticated ? (
        <div className="auth-status">
          <div className="user-info">
            <p>Logged in as: {user?.email?.address || user?.google?.email || user?.twitter?.username || 'User'}</p>
            {statusMessage && (
              <p className="wallet-status">{statusMessage}</p>
            )}
            {accountState && (
              <>
                <p className="account-info">Account ID: {accountState.accountId}</p>
                {accountState.mpcRegistered && (
                  <p className="mpc-status">Recovery: Enabled</p>
                )}
              </>
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
