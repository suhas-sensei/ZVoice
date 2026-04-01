"use client";

import { useState, useEffect, useCallback } from "react";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: (address: string) => void;
  disconnect: () => void;
}

const STORAGE_KEY = "zvoice_wallet_address";

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setAddress(stored);
  }, []);

  const connect = useCallback((addr: string) => {
    setIsConnecting(true);
    setAddress(addr);
    localStorage.setItem(STORAGE_KEY, addr);
    setIsConnecting(false);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    address,
    isConnected: !!address,
    isConnecting,
    connect,
    disconnect,
  };
}
