"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import ControllerProvider from "@cartridge/controller";
import type { WalletAccount } from "starknet";

interface CartridgeContextType {
  address: string | null;
  username: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  account: WalletAccount | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const CartridgeContext = createContext<CartridgeContextType>({
  address: null,
  username: null,
  isConnected: false,
  isConnecting: false,
  account: null,
  connect: async () => {},
  disconnect: async () => {},
});

export function useCartridge() {
  return useContext(CartridgeContext);
}

let controllerInstance: ControllerProvider | null = null;

function getController(): ControllerProvider {
  if (!controllerInstance) {
    controllerInstance = new ControllerProvider({
      rpc: "https://starknet-sepolia.public.blastapi.io",
      theme: "zvoice",
      colorMode: "dark",
    });
  }
  return controllerInstance;
}

export function CartridgeProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Probe for existing session on mount
  useEffect(() => {
    const controller = getController();
    controller.probe().then((acc) => {
      if (acc) {
        setAccount(acc);
        setAddress(acc.address);
        controller.username()?.then((name) => setUsername(name));
      }
    }).catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const controller = getController();
      const acc = await controller.connect();
      if (acc) {
        setAccount(acc);
        setAddress(acc.address);
        const name = await controller.username();
        if (name) setUsername(name);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const controller = getController();
    await controller.disconnect();
    setAddress(null);
    setUsername(null);
    setAccount(null);
  }, []);

  return (
    <CartridgeContext.Provider
      value={{
        address,
        username,
        isConnected: !!address,
        isConnecting,
        account,
        connect,
        disconnect,
      }}
    >
      {children}
    </CartridgeContext.Provider>
  );
}
