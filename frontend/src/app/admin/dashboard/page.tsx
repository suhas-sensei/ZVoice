"use client";

import { useState } from "react";
import CipherText from "@/components/CipherText";

const invoices = [
  { id: 0, employee: "0x6908...efe2", vendor: "stripe.com", amount: "$5.00", status: "auto", proof: "Verified" },
  { id: 1, employee: "0x6908...efe2", vendor: "stripe.com", amount: "$10.77", status: "auto", proof: "Verified" },
  { id: 2, employee: "0x6908...efe2", vendor: "aws.amazon.com", amount: "$3,500.00", status: "approved", proof: "Verified" },
  { id: 3, employee: "0x6908...efe2", vendor: "figma.com", amount: "$75.00", status: "pending", proof: "Verified" },
  { id: 4, employee: "0x6908...efe2", vendor: "github.com", amount: "$231.00", status: "paid", proof: "Verified" },
];

const spendingData = [12400, 18200, 15800, 22100, 19500, 28400, 24600, 31200, 27800, 35100, 29400, 38200];
const spendingMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const topVendors = [
  { name: "AWS", amount: "$18,400", pct: 82 },
  { name: "Stripe", amount: "$7,200", pct: 32 },
  { name: "GitHub", amount: "$4,620", pct: 21 },
  { name: "Figma", amount: "$1,500", pct: 7 },
  { name: "Vercel", amount: "$960", pct: 4 },
];

const approvalBreakdown = [
  { label: "Auto-Approved", value: 77, color: "bg-cyan-400" },
  { label: "Manually Approved", value: 16, color: "bg-blue-400" },
  { label: "Pending", value: 5, color: "bg-yellow-400" },
  { label: "Rejected", value: 2, color: "bg-red-400" },
];

function SpendingChart() {
  const max = Math.max(...spendingData);
  const min = Math.min(...spendingData);
  const range = max - min || 1;
  const w = 600; const h = 100;
  const points = spendingData.map((v, i) => `${(i / (spendingData.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const fill = points + ` ${w},${h} 0,${h}`;
  return (
    <svg width={w} height={h} className="w-full h-[100px]">
      <defs>
        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill="url(#spendGrad)" />
      <polyline points={points} fill="none" stroke="#000" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {spendingData.map((v, i) => (
        <circle key={i} cx={(i / (spendingData.length - 1)) * w} cy={h - ((v - min) / range) * h} r="3" fill="#000" />
      ))}
    </svg>
  );
}

const statusStyles: Record<string, string> = {
  pending: "text-yellow-600 bg-yellow-50 border-yellow-200",
  approved: "text-blue-600 bg-blue-50 border-blue-200",
  auto: "text-cyan-600 bg-cyan-50 border-cyan-200",
  paid: "text-green-600 bg-green-50 border-green-200",
  rejected: "text-red-600 bg-red-50 border-red-200",
};

export default function AdminPage() {
  const [filter, setFilter] = useState("all");
  const [autoApproveLimit, setAutoApproveLimit] = useState("50");
  const [monthlyCap, setMonthlyCap] = useState("1000");

  const stats = [
    { label: "Total", value: "2" },
    { label: "Pending", value: "0" },
    { label: "Approved", value: "2" },
    { label: "Auto-Approved", value: "2" },
    { label: "Paid", value: "0" },
    { label: "Pending $", value: "$0.00" },
  ];

  const filtered = filter === "all" ? invoices : invoices.filter(inv => inv.status === filter);
  const tabs = ["all", "pending", "auto", "approved", "paid", "rejected"];

  return (
    <div className="min-h-screen bg-[#fafafa] relative overflow-hidden">
      {/* Cipher background */}
      <div className="absolute inset-0 z-0 opacity-30">
        <CipherText />
      </div>

      {/* Content */}
      <div className="relative z-10 p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black tracking-tight text-black">Admin</h1>
          <a href="/admin" className="text-sm text-black/30 hover:text-black/60 transition-colors">&larr; Back</a>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="bg-white border border-black/8 rounded-xl shadow-sm p-4"
              style={{ animation: `cardFloat 0.6s ease-out ${i * 0.06}s both` }}
            >
              <p className="text-xs text-black/40 mb-2">{s.label}</p>
              <p className="text-2xl font-black text-black">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Main layout: left content + right analytics */}
        <div className="flex gap-6">
          {/* Left column */}
          <div className="flex-1 min-w-0">

        {/* On-Chain Policy Engine */}
        <div
          className="bg-white border border-black/8 rounded-xl shadow-sm p-6 mb-5"
          style={{ animation: `cardFloat 0.6s ease-out 0.4s both` }}
        >
          <h2 className="text-base font-bold text-black mb-4">On-Chain Policy Engine</h2>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-xs text-black/40 mb-1.5">Auto-approve under ($)</p>
              <input
                value={autoApproveLimit}
                onChange={e => setAutoApproveLimit(e.target.value)}
                className="bg-black/5 border border-black/10 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-black/30 text-black"
              />
            </div>
            <div>
              <p className="text-xs text-black/40 mb-1.5">Monthly cap per employee ($)</p>
              <input
                value={monthlyCap}
                onChange={e => setMonthlyCap(e.target.value)}
                className="bg-black/5 border border-black/10 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-black/30 text-black"
              />
            </div>
            <button className="bg-black text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-black/80 transition-colors">
              Save to Chain
            </button>
          </div>
        </div>

        {/* Bulk actions */}
        <div
          className="flex gap-3 mb-6"
          style={{ animation: `cardFloat 0.6s ease-out 0.5s both` }}
        >
          <button className="bg-white border border-black/10 shadow-sm text-black/40 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-black/5 transition-colors">
            Approve All Pending (0)
          </button>
          <button className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-black/80 transition-colors">
            Pay All Approved (2)
          </button>
        </div>

        {/* Filter tabs + Refresh */}
        <div
          className="flex items-center justify-between mb-4"
          style={{ animation: `cardFloat 0.6s ease-out 0.55s both` }}
        >
          <div className="flex gap-2">
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors capitalize font-medium ${
                  filter === t
                    ? "bg-black text-white"
                    : "bg-white border border-black/8 text-black/50 hover:text-black shadow-sm"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="text-sm text-black/30 hover:text-black/60 transition-colors">Refresh</button>
        </div>

        {/* Invoice table */}
        <div
          className="bg-white border border-black/8 rounded-xl shadow-sm overflow-hidden"
          style={{ animation: `cardFloat 0.6s ease-out 0.6s both` }}
        >
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_1fr_100px_120px_100px_120px] gap-4 px-5 py-3 border-b border-black/5">
            {["ID", "Employee", "Vendor", "Amount", "Status", "Proof", "Actions"].map(h => (
              <p key={h} className="text-xs font-semibold text-black/30 uppercase tracking-wide">{h}</p>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((inv, i) => (
            <div
              key={inv.id}
              className={`grid grid-cols-[60px_1fr_1fr_100px_120px_100px_120px] gap-4 px-5 py-4 items-center hover:bg-black/[0.02] transition-colors ${i < filtered.length - 1 ? "border-b border-black/5" : ""}`}
            >
              <p className="text-sm text-black/40 font-mono">#{inv.id}</p>
              <p className="text-sm font-mono text-black/60 truncate">{inv.employee}</p>
              <p className="text-sm font-medium text-black">{inv.vendor}</p>
              <p className="text-sm font-bold text-black">{inv.amount}</p>
              <div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border capitalize ${statusStyles[inv.status]}`}>
                  {inv.status === "auto" ? "Auto" : inv.status}
                </span>
              </div>
              <p className="text-sm text-green-600 font-medium">{inv.proof}</p>
              <div className="flex gap-2">
                {inv.status === "pending" && (
                  <>
                    <button className="bg-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors">
                      Approve
                    </button>
                    <button className="bg-black/5 text-black/50 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-black/10 transition-colors">
                      Reject
                    </button>
                  </>
                )}
                {(inv.status === "approved" || inv.status === "auto") && (
                  <button className="bg-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors">
                    Pay
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

          </div>{/* end left column */}

          {/* Right analytics column */}
          <div className="w-[300px] flex-shrink-0 space-y-4">

            {/* Spending chart */}
            <div className="bg-white border border-black/8 rounded-xl shadow-sm p-5" style={{ animation: `cardFloat 0.6s ease-out 0.38s both` }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-black">Total Spending</p>
                <p className="text-[10px] text-black/30">12 months</p>
              </div>
              <p className="text-2xl font-black text-black mb-3">$302,400</p>
              <SpendingChart />
              <div className="flex justify-between mt-2">
                {spendingMonths.map((m, i) => (
                  <span key={m} className={`text-[8px] ${i === 11 ? "font-bold text-black" : "text-black/20"}`}>{m}</span>
                ))}
              </div>
            </div>

            {/* Approval breakdown */}
            <div className="bg-white border border-black/8 rounded-xl shadow-sm p-5" style={{ animation: `cardFloat 0.6s ease-out 0.44s both` }}>
              <p className="text-sm font-bold text-black mb-3">Approval Breakdown</p>
              <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-4">
                {approvalBreakdown.map(a => (
                  <div key={a.label} className={`${a.color} h-full`} style={{ width: `${a.value}%` }} />
                ))}
              </div>
              <div className="space-y-2.5">
                {approvalBreakdown.map(a => (
                  <div key={a.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${a.color}`} />
                      <span className="text-xs text-black/60">{a.label}</span>
                    </div>
                    <span className="text-xs font-bold text-black">{a.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top vendors */}
            <div className="bg-white border border-black/8 rounded-xl shadow-sm p-5" style={{ animation: `cardFloat 0.6s ease-out 0.5s both` }}>
              <p className="text-sm font-bold text-black mb-4">Top Vendors</p>
              <div className="space-y-3">
                {topVendors.map((v) => (
                  <div key={v.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-black">{v.name}</span>
                      <span className="text-xs font-bold text-black">{v.amount}</span>
                    </div>
                    <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full bg-black rounded-full" style={{ width: `${v.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>{/* end right analytics column */}

        </div>{/* end main layout */}

      </div>

      <style jsx global>{`
        @keyframes cardFloat {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
