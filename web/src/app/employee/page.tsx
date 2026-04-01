"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";
import { GmailConnect } from "@/components/GmailConnect";
import { ProofStatus } from "@/components/ProofStatus";
import type { ProofStatusType } from "@/components/ProofStatus";
import { useWallet } from "@/hooks/useWallet";
import { useInvoices } from "@/hooks/useInvoices";

interface ScannedEmail {
  messageId: string;
  from: string;
  subject: string;
  date: string;
  vendor: string;
  amountCents: number;
}

export default function EmployeePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}>
      <EmployeePageContent />
    </Suspense>
  );
}

function EmployeePageContent() {
  const { address, isConnected, connect, disconnect } = useWallet();
  const { invoices, isLoading: invoicesLoading, refresh } = useInvoices();
  const searchParams = useSearchParams();

  const [gmailConnected, setGmailConnected] = useState(false);
  const [scannedEmails, setScannedEmails] = useState<ScannedEmail[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [proofStates, setProofStates] = useState<
    Record<string, ProofStatusType>
  >({});

  useEffect(() => {
    if (searchParams.get("gmail") === "connected") {
      setGmailConnected(true);
    }
  }, [searchParams]);

  const loadInvoices = useCallback(() => {
    if (address) refresh(address);
  }, [address, refresh]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/emails/scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setScannedEmails(data.emails);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerateProof = async (email: ScannedEmail) => {
    if (!address) return;

    setProofStates((prev) => ({
      ...prev,
      [email.messageId]: "generating",
    }));

    try {
      const res = await fetch("/api/proof/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: email.messageId,
          employeeAddress: address,
        }),
      });

      if (res.ok) {
        setProofStates((prev) => ({
          ...prev,
          [email.messageId]: "verified",
        }));
        loadInvoices();
      } else {
        setProofStates((prev) => ({
          ...prev,
          [email.messageId]: "failed",
        }));
      }
    } catch {
      setProofStates((prev) => ({
        ...prev,
        [email.messageId]: "failed",
      }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            ZVoice
          </Link>
          <span className="text-sm text-gray-500">Employee Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <GmailConnect isConnected={gmailConnected} />
          <WalletConnect
            address={address}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400">
              Enter your StarkNet wallet address to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Scan Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Scan Inbox</h2>
                <button
                  onClick={handleScan}
                  disabled={!gmailConnected || isScanning}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {isScanning ? "Scanning..." : "Scan for Invoices"}
                </button>
              </div>

              {!gmailConnected && (
                <p className="text-sm text-gray-500">
                  Connect your Gmail account to scan for invoices.
                </p>
              )}

              {scannedEmails.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-left">
                        <th className="px-4 py-3 font-medium">Vendor</th>
                        <th className="px-4 py-3 font-medium">Subject</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Proof</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedEmails.map((email) => (
                        <tr
                          key={email.messageId}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="px-4 py-3 text-white">
                            {email.vendor}
                          </td>
                          <td className="px-4 py-3 text-gray-400 truncate max-w-[200px]">
                            {email.subject}
                          </td>
                          <td className="px-4 py-3 text-white font-medium">
                            ${(email.amountCents / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(email.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <ProofStatus
                              status={
                                proofStates[email.messageId] || "none"
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleGenerateProof(email)}
                              disabled={
                                proofStates[email.messageId] === "generating" ||
                                proofStates[email.messageId] === "verified"
                              }
                              className="text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1 rounded transition-colors"
                            >
                              {proofStates[email.messageId] === "verified"
                                ? "Submitted"
                                : "Generate Proof"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* On-chain Invoices Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Your Invoices</h2>
                <button
                  onClick={loadInvoices}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Refresh
                </button>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {invoicesLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading...
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No invoices submitted yet. Scan your inbox and generate
                    proofs above.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-left">
                        <th className="px-4 py-3 font-medium">ID</th>
                        <th className="px-4 py-3 font-medium">Vendor</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                            #{inv.id}
                          </td>
                          <td className="px-4 py-3 text-white">{inv.vendor}</td>
                          <td className="px-4 py-3 text-white font-medium">
                            ${(inv.amountCents / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(inv.timestamp * 1000).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-1 rounded capitalize ${
                                inv.status === "paid"
                                  ? "bg-green-900/30 text-green-400"
                                  : inv.status === "approved"
                                  ? "bg-blue-900/30 text-blue-400"
                                  : inv.status === "rejected"
                                  ? "bg-red-900/30 text-red-400"
                                  : "bg-yellow-900/30 text-yellow-400"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {inv.paymentTx && (
                              <a
                                href={`https://sepolia.starkscan.co/tx/${inv.paymentTx}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline"
                              >
                                View
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
