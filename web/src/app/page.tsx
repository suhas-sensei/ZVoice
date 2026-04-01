import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
          ZVoice
        </h1>
        <p className="text-xl text-gray-400 mb-2">
          Privacy-Preserving Invoice Reimbursement
        </p>
        <p className="text-sm text-gray-500 mb-12">
          ZK Email proofs verify your invoices without exposing email content.
          <br />
          StarkZap pays you in your preferred token on StarkNet.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/employee"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-lg transition-colors text-lg"
          >
            Employee Portal
          </Link>
          <Link
            href="/admin"
            className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-8 py-3 rounded-lg transition-colors text-lg border border-gray-700"
          >
            Admin Portal
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl mb-2 font-mono font-bold text-blue-400">
              ZK
            </div>
            <h3 className="font-semibold text-white mb-1">
              Zero-Knowledge Proofs
            </h3>
            <p className="text-sm text-gray-400">
              DKIM signatures prove invoice emails are real without revealing
              your inbox.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl mb-2 font-mono font-bold text-purple-400">
              SN
            </div>
            <h3 className="font-semibold text-white mb-1">
              StarkNet On-Chain
            </h3>
            <p className="text-sm text-gray-400">
              Invoice commitments stored on StarkNet. Immutable audit trail for
              every reimbursement.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl mb-2 font-mono font-bold text-green-400">
              SZ
            </div>
            <h3 className="font-semibold text-white mb-1">
              StarkZap Payments
            </h3>
            <p className="text-sm text-gray-400">
              Get paid in USDC, STRK, or ETH. Auto-swap from treasury via
              StarkZap SDK.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
