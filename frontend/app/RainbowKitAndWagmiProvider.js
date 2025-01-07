'use client';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { baseSepolia } from '@/utils/baseSepolia';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

const config = getDefaultConfig({
    appName: 'My RainbowKit App',
    projectId: '4489b42c961ba6584ce52f1aa3027935',
    chains: [baseSepolia],
    ssr: true, // If your dApp uses server side rendering (SSR)
  });

const queryClient = new QueryClient();

const RainbowKitAndWagmiProvider = ({ children }) => {
    return (
        <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    ) 
}
export default RainbowKitAndWagmiProvider;

