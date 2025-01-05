'use client';
import {useState, useEffect} from 'react';
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RocketIcon } from "@radix-ui/react-icons"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"
import { contractAddress, contractABI, tokenAAddress, tokenBAddress } from '@/constants';
import { useReadContract, useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';

const TOKEN_ABI = [
    {
        name: 'mint',
        type: 'function',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        name: 'approve',
        type: 'function',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable'
    }
];

const Swap = () => {
    const [loading, setLoading] = useState(false);
    const { address, isConnected } = useAccount();
    const { toast } = useToast();
    const publicClient = usePublicClient();

    // Get token balances
    const { data: balanceA, refetch: refetchBalanceA } = useReadContract({
        address: tokenAAddress,
        abi: TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
        enabled: !!address,
    });

    const { data: balanceB, refetch: refetchBalanceB } = useReadContract({
        address: tokenBAddress,
        abi: TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
        enabled: !!address,
    });

    const { writeContractAsync: mintTokens } = useWriteContract();
    const { writeContractAsync: approveTokens } = useWriteContract();

    const handleMintAndApprove = async () => {
        try {
            setLoading(true);
            const mintAmount = parseEther('10000');

            console.log('Starting mint process...');
            console.log('Token A address:', tokenAAddress);
            console.log('Token B address:', tokenBAddress);
            console.log('DEX address:', contractAddress);
            console.log('Wallet address:', address);

            // Mint Token A
            const mintATx = await mintTokens({
                address: tokenAAddress,
                abi: TOKEN_ABI,
                functionName: 'mint',
                args: [mintAmount],
            });

            toast({
                title: "Token A Minting",
                description: "Minting Token A, please wait...",
            });

            const receiptA = await publicClient.waitForTransactionReceipt({ hash: mintATx });
            console.log('Token A mint receipt:', receiptA);

            // Mint Token B
            const mintBTx = await mintTokens({
                address: tokenBAddress,
                abi: TOKEN_ABI,
                functionName: 'mint',
                args: [mintAmount],
            });

            toast({
                title: "Token B Minting",
                description: "Minting Token B, please wait...",
            });

            const receiptB = await publicClient.waitForTransactionReceipt({ hash: mintBTx });
            console.log('Token B mint receipt:', receiptB);

            // Approve Token A
            const approveATx = await approveTokens({
                address: tokenAAddress,
                abi: TOKEN_ABI,
                functionName: 'approve',
                args: [contractAddress, mintAmount],
            });

            await publicClient.waitForTransactionReceipt({ hash: approveATx });

            // Approve Token B
            const approveBTx = await approveTokens({
                address: tokenBAddress,
                abi: TOKEN_ABI,
                functionName: 'approve',
                args: [contractAddress, mintAmount],
            });

            await publicClient.waitForTransactionReceipt({ hash: approveBTx });

            toast({
                title: "Success",
                description: "Successfully minted and approved 10,000 of both tokens!",
            });

            // Refresh balances
            await Promise.all([
                refetchBalanceA(),
                refetchBalanceB()
            ]);

        } catch (err) {
            console.error('Error:', err);
            toast({
                title: "Transaction Failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Log balances when they change
    useEffect(() => {
        if (address) {
            console.log('Current balances:');
            console.log('Token A:', balanceA ? formatEther(balanceA) : '0');
            console.log('Token B:', balanceB ? formatEther(balanceB) : '0');
        }
    }, [balanceA, balanceB, address]);

    return (
        <div className="max-w-md mx-auto p-6 space-y-6">
            <div className="text-sm space-y-2">
                <p>Wallet: {address || 'Not connected'}</p>
                <p>Token A Balance: {balanceA ? formatEther(balanceA) : '0'}</p>
                <p>Token B Balance: {balanceB ? formatEther(balanceB) : '0'}</p>
            </div>

            <Button 
                onClick={handleMintAndApprove}
                disabled={loading || !isConnected}
                className="w-full"
            >
                {loading ? 'Processing...' : 'Mint & Approve 10,000 Tokens'}
            </Button>
        </div>
    );
};

export default Swap;