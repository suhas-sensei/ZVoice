"use client";

import { useState } from "react";

const transactions = [
  { icon: "■", vendor: "AWS", date: "01 Apr 2026 10:00", amount: "$3,500" },
  { icon: "◆", vendor: "Figma", date: "28 Mar 2026 09:30", amount: "$75" },
  { icon: "●", vendor: "GitHub", date: "25 Mar 2026 14:15", amount: "$231" },
  { icon: "▪", vendor: "Notion", date: "22 Mar 2026 11:00", amount: "$48" },
  { icon: "◇", vendor: "Stripe", date: "20 Mar 2026 16:45", amount: "$189" },
  { icon: "▲", vendor: "Vercel", date: "18 Mar 2026 08:20", amount: "$20" },
  { icon: "▶", vendor: "Slack", date: "15 Mar 2026 12:00", amount: "$150" },
  { icon: "◈", vendor: "Supabase", date: "12 Mar 2026 10:30", amount: "$25" },
];

const chartData = [40, 55, 45, 70, 60, 80, 65, 90, 75, 95, 85, 70];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MiniLineChart() {
  const max = Math.max(...chartData);
  const min = Math.min(...chartData);
  const range = max - min || 1;
  const w = 400;
  const h = 160;
  const points = chartData.map((v, i) => `${(i / (chartData.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const fillPoints = points + ` ${w},${h} 0,${h}`;

  return (
    <svg width={w} height={h} className="w-full h-[160px]">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#chartGrad)" />
      <polyline points={points} fill="none" stroke="#000" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const [activeTime, setActiveTime] = useState("Month");
  const [activeNav, setActiveNav] = useState(0);

  const navIcons = ["⌂", "✉", "▤", "◉", "⊕", "⚙"];

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex">
      {/* Left sidebar */}
      <div className="w-14 flex flex-col items-center pt-4 gap-4 flex-shrink-0">
        {navIcons.map((icon, i) => (
          <button
            key={i}
            onClick={() => setActiveNav(i)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors ${
              activeNav === i ? "bg-black/5 text-black" : "text-black/30 hover:bg-black/5"
            }`}
          >
            {icon}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-14 flex items-center px-4 gap-3">
          <span className="text-xl font-black tracking-tight">ZVoice</span>
          <div className="flex-1 max-w-xs ml-4">
            <div className="bg-[#f5f5f7] rounded-md px-3 py-1.5 text-sm text-black/30 flex items-center gap-1.5">
              ○ Search
            </div>
          </div>
          <div className="flex-1" />
          <span className="text-xs text-black/30">EN</span>
          <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-xs text-black/40">●</div>
          <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-xs font-bold text-black/50">S</div>
        </div>

        {/* Content */}
        <div className="flex-1 flex p-4 gap-4">
          {/* Left column */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-black mb-4">Dashboard</h2>

            {/* Wallet card + upcoming */}
            <div className="flex gap-3 mb-6">
              <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 text-white w-[260px] flex-shrink-0">
                <div className="flex justify-between items-start mb-6">
                  <span className="text-sm text-white/30">◉</span>
                  <span className="text-xs text-white/30">StarkNet</span>
                </div>
                <p className="text-base font-mono tracking-widest mb-4">0x7dcf ···· ···· 0803</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[11px] text-white/30 uppercase">Employee</p>
                    <p className="text-sm font-medium">suhas3</p>
                  </div>
                  <p className="text-sm font-bold text-white/60">Sepolia</p>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-black/40 mb-2">Upcoming Payments</p>
                <div className="flex gap-2">
                  <div className="p-3 flex-1">
                    <span className="text-base text-black/30 block mb-1">◈</span>
                    <p className="text-sm font-semibold text-black">Batch Pay</p>
                    <p className="text-xs text-black/30">3 pending</p>
                    <p className="text-sm font-bold text-black mt-1">$4,238.50</p>
                  </div>
                  <div className="p-3 flex-1">
                    <span className="text-base text-black/30 block mb-1">⇄</span>
                    <p className="text-sm font-semibold text-black">StarkZap</p>
                    <p className="text-xs text-black/30">Auto-swap</p>
                    <p className="text-sm font-bold text-black mt-1">USDC → STRK</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-black">Recent Transactions</h3>
              <a
                href="http://localhost:3010/employee"
                className="bg-black text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-black/90 transition-colors"
              >
                Scan Invoices
              </a>
            </div>

            <div>
              {transactions.map((tx, i) => (
                <div
                  key={i}
                  className={`flex items-center px-3 py-3 ${i < transactions.length - 1 ? "border-b border-black/5" : ""} hover:bg-black/[0.02] transition-colors`}
                >
                  <span className="w-8 h-8 bg-[#f5f5f7] rounded-lg flex items-center justify-center text-xs text-black/40 flex-shrink-0">
                    {tx.icon}
                  </span>
                  <p className="ml-3 text-sm font-medium text-black flex-1">{tx.vendor}</p>
                  <p className="text-xs text-black/25 mx-3 flex-shrink-0">{tx.date}</p>
                  <p className="text-sm font-bold text-black w-20 text-right flex-shrink-0">{tx.amount}</p>
                  <span className="ml-3 text-black/15 text-base">⋮</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="w-[320px] flex-shrink-0">
            <div className="p-4 mb-4">
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm text-black/40">Reimbursed This Month</p>
                <span className="text-black/15 text-base">⋮</span>
              </div>
              <p className="text-3xl font-black text-black mb-4">$4,238.50</p>

              <div className="flex gap-1 mb-3">
                {["Day", "Week", "Month", "Year"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTime(t)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      activeTime === t ? "bg-black text-white" : "text-black/30 hover:text-black/60"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <MiniLineChart />

              <div className="flex justify-between mt-1">
                {months.map((m, i) => (
                  <span key={m} className={`text-[10px] ${i === 3 ? "bg-black text-white px-1 py-0.5 rounded-full" : "text-black/20"}`}>
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl p-4 text-white">
              <p className="text-sm text-white/40 mb-0.5">ZK Verification</p>
              <p className="text-base font-bold mb-3">8 of 8 Verified</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: "100%" }} />
                  </div>
                  <p className="text-xs text-white/30 mt-1">All invoices DKIM verified</p>
                </div>
                <div className="w-14 h-14 rounded-full border-[3px] border-green-400 flex items-center justify-center">
                  <span className="text-sm font-black">100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
