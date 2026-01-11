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
          requireUserPasswordOnCreate: false,
        },
        supportedChains: [
          {
            id: 1,
            name: 'Ethereum',
            network: 'mainnet',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://cloudflare-eth.com'] },
            },
          },
        ],
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
)
