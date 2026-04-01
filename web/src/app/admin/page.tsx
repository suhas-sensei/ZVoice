"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { PaymentModal } from "@/components/PaymentModal";
import { useCartridge } from "@/components/CartridgeProvider";
import { useInvoices } from "@/hooks/useInvoices";
import type { Invoice } from "@/lib/types";

export default function AdminPage() {
  const { address, isConnected } = useCartridge();
  const { invoices, isLoading, error, refresh } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Policy state
  const [threshold, setThreshold] = useState<string>("");
  const [monthlyCap, setMonthlyCap] = useState<string>("");
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyMsg, setPolicyMsg] = useState("");

  const loadAll = useCallback(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (isConnected) loadAll();
  }, [isConnected, loadAll]);

  // Auto-refresh every 5 seconds for real-time updates
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [isConnected, loadAll]);

  // Load policy on mount
  useEffect(() => {
    if (!isConnected) return;
    fetch("/api/policy")
      .then((r) => r.json())
      .then((data) => {
        if (data.threshold) setThreshold(String(data.threshold / 100));
        if (data.monthlyCap) setMonthlyCap(String(data.monthlyCap / 100));
      })
      .catch(() => {});
  }, [isConnected]);

  const filtered = invoices.filter((inv) => {
    if (filter === "all") return true;
    if (filter === "auto_approved") return inv.status === "auto_approved";
    return inv.status === filter;
  });

  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  const approvedInvoices = invoices.filter(
    (i) => i.status === "approved" || i.status === "auto_approved"
  );

  const stats = {
    total: invoices.length,
    pending: pendingInvoices.length,
    approved: approvedInvoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    autoApproved: invoices.filter((i) => i.status === "auto_approved").length,
    pendingAmount: pendingInvoices.reduce((sum, i) => sum + i.amountCents, 0),
  };

  const handleBatchApprove = async () => {
    const ids = pendingInvoices.map((i) => i.id);
    if (ids.length === 0) return;
    setBatchProcessing(true);
    try {
      await fetch("/api/invoice/batch-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: ids, adminAddress: address }),
      });
      loadAll();
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchPay = async () => {
    const ids = approvedInvoices.map((i) => i.id);
    if (ids.length === 0) return;
    setBatchProcessing(true);
    try {
      await fetch("/api/invoice/batch-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: ids, adminAddress: address }),
      });
      loadAll();
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleReject = async (inv: Invoice) => {
    try {
      await fetch("/api/invoice/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: inv.id, adminAddress: address }),
      });
      loadAll();
    } catch {
      // handled
    }
  };

  const handleSavePolicy = async () => {
    setPolicyLoading(true);
    setPolicyMsg("");
    try {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threshold: Math.round(parseFloat(threshold || "0") * 100),
          monthlyCap: Math.round(parseFloat(monthlyCap || "0") * 100),
          adminAddress: address,
        }),
      });
      if (res.ok) setPolicyMsg("Policy updated on-chain");
      else setPolicyMsg("Failed to update policy");
    } finally {
      setPolicyLoading(false);
      setTimeout(() => setPolicyMsg(""), 3000);
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
    const label = status === "auto_approved" ? "auto" : status;
    return (
      <span
        className={`text-xs px-2 py-1 rounded capitalize ${styles[status] || styles.pending}`}
      >
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
          <span className="text-sm text-gray-500">Admin Portal</span>
        </div>
        <WalletConnect />
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-2">Admin Access</h2>
            <p className="text-gray-400">
              Sign in to manage invoice approvals and payments.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-400">Total</div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </div>
              <div className="bg-gray-900 border border-yellow-800/50 rounded-xl p-4">
                <div className="text-sm text-yellow-400">Pending</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {stats.pending}
                </div>
              </div>
              <div className="bg-gray-900 border border-blue-800/50 rounded-xl p-4">
                <div className="text-sm text-blue-400">Approved</div>
                <div className="text-2xl font-bold text-blue-400">
                  {stats.approved}
                </div>
              </div>
              <div className="bg-gray-900 border border-cyan-800/50 rounded-xl p-4">
                <div className="text-sm text-cyan-400">Auto-Approved</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {stats.autoApproved}
                </div>
              </div>
              <div className="bg-gray-900 border border-green-800/50 rounded-xl p-4">
                <div className="text-sm text-green-400">Paid</div>
                <div className="text-2xl font-bold text-green-400">
                  {stats.paid}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-400">Pending $</div>
                <div className="text-2xl font-bold">
                  ${(stats.pendingAmount / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Policy Engine Config */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                On-Chain Policy Engine
              </h3>
              <div className="flex items-end gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Auto-approve under ($)
                  </label>
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="50"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-28 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Monthly cap per employee ($)
                  </label>
                  <input
                    type="number"
                    value={monthlyCap}
                    onChange={(e) => setMonthlyCap(e.target.value)}
                    placeholder="500"
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-28 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handleSavePolicy}
                  disabled={policyLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {policyLoading ? "Saving..." : "Save to Chain"}
                </button>
                {policyMsg && (
                  <span className="text-xs text-green-400">{policyMsg}</span>
                )}
              </div>
            </section>

            {/* Batch Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleBatchApprove}
                disabled={batchProcessing || stats.pending === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {batchProcessing
                  ? "Processing..."
                  : `Approve All Pending (${stats.pending})`}
              </button>
              <button
                onClick={handleBatchPay}
                disabled={batchProcessing || stats.approved === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {batchProcessing
                  ? "Processing..."
                  : `Pay All Approved (${stats.approved})`}
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {["all", "pending", "auto_approved", "approved", "paid", "rejected"].map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      filter === f
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {f === "auto_approved" ? "auto" : f}
                  </button>
                )
              )}
              <button
                onClick={loadAll}
                className="ml-auto text-xs text-gray-400 hover:text-white transition-colors"
              >
                Refresh
              </button>
            </div>

            {error && (
              <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Invoice Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No invoices found.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-left">
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Vendor</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Proof</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                          #{inv.id}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300">
                          {inv.employee.slice(0, 6)}...{inv.employee.slice(-4)}
                        </td>
                        <td className="px-4 py-3 text-white">{inv.vendor}</td>
                        <td className="px-4 py-3 text-white font-medium">
                          ${(inv.amountCents / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs ${inv.proofVerified ? "text-green-400" : "text-gray-500"}`}
                          >
                            {inv.proofVerified ? "Verified" : "None"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {inv.status === "pending" && (
                              <>
                                <button
                                  onClick={() => setSelectedInvoice(inv)}
                                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
                                >
                                  Approve & Pay
                                </button>
                                <button
                                  onClick={() => handleReject(inv)}
                                  className="text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1 rounded transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {(inv.status === "approved" ||
                              inv.status === "auto_approved") && (
                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors"
                              >
                                Pay
                              </button>
                            )}
                            {inv.paymentTx && (
                              <a
                                href={`https://sepolia.starkscan.co/tx/${inv.paymentTx}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline leading-6"
                              >
                                View Tx
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {selectedInvoice && address && (
        <PaymentModal
          invoice={selectedInvoice}
          adminAddress={address}
          onClose={() => setSelectedInvoice(null)}
          onSuccess={() => {
            setSelectedInvoice(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}
