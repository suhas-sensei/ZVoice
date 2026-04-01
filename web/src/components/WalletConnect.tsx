"use client";

import { useCartridge } from "./CartridgeProvider";

export function WalletConnect() {
  const { address, username, isConnected, isConnecting, connect, disconnect } = useCartridge();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-sm text-gray-300">
          {username || `${address.slice(0, 6)}...${address.slice(-4)}`}
        </span>
        <button
          onClick={disconnect}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
    >
      {isConnecting ? "Connecting..." : "Sign In"}
    </button>
  );
}
