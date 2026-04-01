"use client";

import { useState } from "react";

interface WalletConnectProps {
  address: string | null;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

export function WalletConnect({
  address,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  if (address) {
    return (
      <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-sm text-gray-300 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={onDisconnect}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x..."
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-80"
        />
        <button
          onClick={() => {
            if (input.startsWith("0x") && input.length > 10) {
              onConnect(input);
              setShowInput(false);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Connect
        </button>
        <button
          onClick={() => setShowInput(false)}
          className="text-gray-500 hover:text-gray-300 text-sm px-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
    >
      Connect Wallet
    </button>
  );
}
