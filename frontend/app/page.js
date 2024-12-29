'use client';
import NotConnected from "@/components/shared/NotConnected";
import Swap from "@/components/shared/Swap";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();
  return (
    <>
    {isConnected ? (
      <Swap />
    ) : (
      <NotConnected />
    )}
  </>
)
  ;
}
