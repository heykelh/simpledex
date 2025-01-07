const RPC = process.env.NEXT_PUBLIC_ALCHEMY_RPC || "";

export const baseSepolia = {
    id: 84532,
    name: "Base Sepolia",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: {
            http: [RPC],
        },
    },
    blockExplorers: {
        default: {
            name: "BaseScan",
            url: "https://sepolia.basescan.org",
        },
    },
    contracts: {
        multicall3: {
            address: "0xca11bde05977b3631167028862be2a173976ca11",
            blockCreated: 5022,
        },
        dex: {
            name: "SimpleDEX",
            address: "0x3690d65EdD0EDC08E0697fAe1697c7aEBF06E90C",
        },
        tokenA: {
            name: "TokenA",
            address: "0x3304Bb897E4DA4336bD9725A821Cd0d0b6116697",
        },
        tokenB: {
            name: "TokenB",
            address: "0x0498a5D08Fc091edbeC5E9910beB6f66b37c8B4C",
        },
    },
    testnet: true,
};
