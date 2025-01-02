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
import { contractAddress, contractABI } from '@/constants';
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbiItem } from 'viem';
import { publicClient } from '@/utils/client';

const Swap = () => {
    return (
        <div>
            <p>Swap</p>
        </div>
    )
}

export default Swap;