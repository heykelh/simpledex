import { createPublicClient, http } from 'viem';
import { sepoliaBase } from 'wagmi/chains';

export const publicClient = createPublicClient({
    chain: sepoliaBase,
    transport: http('https://base-sepolia.g.alchemy.com/v2/tVhUVufjmGpV2HNuKCr74jD3A6E5_6ci'),
});