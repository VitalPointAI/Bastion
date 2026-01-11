import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import './index.css'
import App from './App.tsx'

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

if (!privyAppId) {
  throw new Error('VITE_PRIVY_APP_ID is not defined in environment variables')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'google', 'twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#646cff',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        supportedChains: [
          // NEAR testnet configuration
          {
            id: 397, // NEAR testnet chain ID
            name: 'NEAR Testnet',
            network: 'testnet',
            nativeCurrency: { name: 'NEAR', symbol: 'NEAR', decimals: 24 },
            rpcUrls: {
              default: { http: [import.meta.env.VITE_NEAR_RPC || 'https://rpc.testnet.near.org'] },
            },
          },
        ],
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
