import { createPublicClient, http } from 'viem';
import { hardhat, sepolia, sepoliaBase } from 'wagmi/chains';

export const publicClient = createPublicClient({
    chain: hardhat, sepolia, sepoliaBase,
    transport: http(),
});