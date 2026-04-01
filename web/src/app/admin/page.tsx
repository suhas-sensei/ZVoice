"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";
import { InvoiceTable } from "@/components/InvoiceTable";
import { PaymentModal } from "@/components/PaymentModal";
import { useWallet } from "@/hooks/useWallet";
import { useInvoices } from "@/hooks/useInvoices";
import type { Invoice } from "@/lib/types";

export default function AdminPage() {
  const { address, isConnected, connect, disconnect } = useWallet();
  const { invoices, isLoading, error, refresh } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const loadAll = useCallback(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (isConnected) loadAll();
  }, [isConnected, loadAll]);

  const filtered = invoices.filter((inv) => {
    if (filter === "all") return true;
    return inv.status === filter;
  });

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    approved: invoices.filter((i) => i.status === "approved").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    totalAmount: invoices.reduce((sum, i) => sum + i.amountCents, 0),
    pendingAmount: invoices
      .filter((i) => i.status === "pending")
      .reduce((sum, i) => sum + i.amountCents, 0),
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
        <WalletConnect
          address={address}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-semibold mb-2">Admin Access</h2>
            <p className="text-gray-400">
              Connect your admin wallet to manage invoice approvals.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-400">Total Invoices</div>
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
              <div className="bg-gray-900 border border-green-800/50 rounded-xl p-4">
                <div className="text-sm text-green-400">Paid</div>
                <div className="text-2xl font-bold text-green-400">
                  {stats.paid}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-sm text-gray-400">Pending Amount</div>
                <div className="text-2xl font-bold">
                  ${(stats.pendingAmount / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {["all", "pending", "approved", "paid", "rejected"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
                    filter === f
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
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
              <InvoiceTable
                invoices={filtered}
                mode="admin"
                isLoading={isLoading}
                onApprove={(inv) => setSelectedInvoice(inv)}
                onReject={async (inv) => {
                  // Direct reject — no payment needed
                  try {
                    await fetch("/api/invoice/approve", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        invoiceId: inv.id,
                        action: "reject",
                        adminAddress: address,
                      }),
                    });
                    loadAll();
                  } catch {
                    // handled by UI
                  }
                }}
              />
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
