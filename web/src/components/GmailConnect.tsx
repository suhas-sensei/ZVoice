"use client";

import { useState } from "react";

interface GmailConnectProps {
  isConnected: boolean;
}

export function GmailConnect({ isConnected }: GmailConnectProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (isConnected) {
    return (
      <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-sm text-gray-300">Gmail Connected</span>
      </div>
    );
  }

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/gmail");
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z" />
      </svg>
      {isLoading ? "Redirecting..." : "Connect Gmail"}
    </button>
  );
}
