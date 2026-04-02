"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";
import { GmailConnect } from "@/components/GmailConnect";
import { ProofStatus } from "@/components/ProofStatus";
import type { ProofStatusType } from "@/components/ProofStatus";
import { useCartridge } from "@/components/CartridgeProvider";
import { useInvoices } from "@/hooks/useInvoices";
import { SEPOLIA_TOKENS } from "@/lib/tokens";

interface ScannedEmail {
  messageId: string;
  from: string;
  subject: string;
  date: string;
  vendor: string;
  amountCents: number;
}

const TOKEN_OPTIONS = [
  { label: "USDC", address: SEPOLIA_TOKENS.USDC },
  { label: "STRK", address: SEPOLIA_TOKENS.STRK },
  { label: "ETH", address: SEPOLIA_TOKENS.ETH },
];

export default function EmployeePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Loading...
        </div>
      }
    >
      <EmployeePageContent />
    </Suspense>
  );
}

function EmployeePageContent() {
  const { address, isConnected } = useCartridge();
  const { invoices, isLoading: invoicesLoading, refresh } = useInvoices();
  const searchParams = useSearchParams();

  const [gmailConnected, setGmailConnected] = useState(false);
  const [scannedEmails, setScannedEmails] = useState<ScannedEmail[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [proofStates, setProofStates] = useState<
    Record<string, ProofStatusType>
  >({});
  const [preferredToken, setPreferredToken] = useState<string>(SEPOLIA_TOKENS.USDC);
  const [proofData, setProofData] = useState<Record<string, {
    invoiceHash: string;
    txHash: string;
    vendor: string;
    amountCents: number;
    timestamp: number;
    proofVerified: boolean;
  }>>({});
  const [viewingProof, setViewingProof] = useState<string | null>(null);

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

  // Auto-poll for new invoices every 10 seconds
  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => refresh(address), 10000);
    return () => clearInterval(interval);
  }, [address, refresh]);

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
        const data = await res.json();
        setProofStates((prev) => ({
          ...prev,
          [email.messageId]: "verified",
        }));
        setProofData((prev) => ({
          ...prev,
          [email.messageId]: data,
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-green-900/30 text-green-400",
      approved: "bg-blue-900/30 text-blue-400",
      auto_approved: "bg-cyan-900/30 text-cyan-400",
      rejected: "bg-red-900/30 text-red-400",
      pending: "bg-yellow-900/30 text-yellow-400",
    };
    const label = status === "auto_approved" ? "auto-approved" : status;
    return (
      <span className={`text-xs px-2 py-1 rounded capitalize ${styles[status] || styles.pending}`}>
        {label}
      </span>
    );
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
          <WalletConnect />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-2">Sign In to Get Started</h2>
            <p className="text-gray-400">
              Sign in with email via Cartridge to connect your StarkNet wallet.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Token Preference */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-300">
                    Preferred Payment Token
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose which token you want to receive reimbursements in
                  </p>
                </div>
                <div className="flex gap-2">
                  {TOKEN_OPTIONS.map((tok) => (
                    <button
                      key={tok.address}
                      onClick={() => setPreferredToken(tok.address)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        preferredToken === tok.address
                          ? "bg-blue-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      {tok.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

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
                              status={proofStates[email.messageId] || "none"}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
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
                              {proofData[email.messageId] && (
                                <button
                                  onClick={() => setViewingProof(email.messageId)}
                                  className="text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded transition-colors"
                                >
                                  View Proof
                                </button>
                              )}
                            </div>
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
                            {new Date(
                              inv.timestamp * 1000
                            ).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">{statusBadge(inv.status)}</td>
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

      {/* Proof Details Modal */}
      {viewingProof && proofData[viewingProof] && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setViewingProof(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Proof Details</h3>
              <button onClick={() => setViewingProof(null)} className="text-gray-500 hover:text-white text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-green-400 font-medium">
                    {proofData[viewingProof].proofVerified ? "DKIM Verified" : "Not Verified"}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Invoice Hash (Commitment)</p>
                <p className="text-sm text-white font-mono bg-gray-800 rounded px-3 py-2 break-all">
                  {proofData[viewingProof].invoiceHash}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">On-Chain Transaction</p>
                <a
                  href={`https://sepolia.starkscan.co/tx/${proofData[viewingProof].txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline font-mono bg-gray-800 rounded px-3 py-2 break-all block"
                >
                  {proofData[viewingProof].txHash}
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vendor</p>
                  <p className="text-sm text-white">{proofData[viewingProof].vendor}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Amount</p>
                  <p className="text-sm text-white font-medium">
                    ${(proofData[viewingProof].amountCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Timestamp</p>
                <p className="text-sm text-white">
                  {new Date(proofData[viewingProof].timestamp * 1000).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Verification Method</p>
                <p className="text-sm text-white">DKIM Signature — cryptographically proves the email was sent by the vendor&apos;s mail server without exposing email content</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <a
                href={`https://sepolia.starkscan.co/tx/${proofData[viewingProof].txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg text-center transition-colors"
              >
                View on Starkscan
              </a>
              <button
                onClick={() => setViewingProof(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
