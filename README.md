# ZVoice

Privacy-preserving invoice reimbursement on StarkNet. Email arrives, money lands.

## The Problem

Every startup gives employees credit cards for subscriptions. End of month, accounting chases everyone for receipts. Employees dig through Gmail, screenshot invoices, forward PDFs. Reimbursements take weeks.

## The Solution

ZVoice connects to Gmail, finds invoice emails, verifies them using DKIM signatures (zero-knowledge proof that the email is real), and submits them on-chain. The smart contract auto-approves based on policy rules. StarkZap pays the employee in their preferred token.

## How It Works

1. **Employee signs in** with Cartridge Controller (email-based StarkNet wallet)
2. **Connects Gmail** (readonly OAuth — we never modify emails)
3. **Scans inbox** for vendor invoices (Stripe, AWS, Figma, GitHub, etc.)
4. **Generates ZK proof** — DKIM signature proves the email is genuine without exposing content
5. **Submits on-chain** — Cairo contract checks for duplicates, monthly caps, auto-approve threshold
6. **Admin reviews** — dashboard shows all invoices, batch approve/pay
7. **StarkZap pays** — swaps from company treasury token to employee's preferred token (STRK → USDC, ETH, etc.)
8. **Receipt NFT minted** — permanent on-chain proof of reimbursement

## Architecture

### 8 Cairo Smart Contracts

| Contract | Purpose |
|----------|---------|
| **Invoice Registry** | Policy engine, dedup, auto-approve, monthly caps, batch approve |
| **Employee Registry** | On-chain token preferences per employee |
| **Treasury** | Company vault, batch disbursements, access control |
| **Vendor Registry** | Whitelisted vendors, per-vendor spending limits |
| **Multisig Approver** | 2-of-N approval for high-value invoices (>$500) |
| **Reimbursement NFT** | ERC721-like receipt minted for every payment |
| **Spending Analytics** | Per-employee, per-vendor, per-month aggregation |
| **Proof Verifier** | DKIM proof commitments, domain whitelist |

### Tech Stack

- **Contracts**: Cairo 2.16 on StarkNet Sepolia
- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Wallet**: Cartridge Controller (email login, session keys)
- **Payments**: StarkZap SDK (auto-swap via Avnu/Ekubo DEX)
- **Email**: Gmail API (OAuth 2.0, readonly)
- **Proofs**: DKIM signature verification, SHA256 commitment hashes

### TypeScript is Thin

Business logic lives in Cairo. TypeScript only handles:
- Gmail OAuth (can't be on-chain)
- DKIM proof generation (email parsing)
- Frontend rendering

Every rule, every approval check, every spending limit, every duplicate detection runs in Cairo on StarkNet.

## Contract Addresses (Sepolia)

```
Invoice Registry:    0x7dcfc1bd413b958ddebd546e650c2d88ae32547e6e6ce7a24298ea109570803
Employee Registry:   0x3080d072f14a02c1a64a5971a8c118e03b962d60a06cd3f8c8f8c85cd780a99
Treasury:            0x5fe91cf1d98a1987470159cb02723d78dcaf19766af3b356bd982ce0cdbf19f
Vendor Registry:     0x3de199a2a6c88c0f3bd6257c56f38e0b18d8c3a31d24d9c4af490312aa1a205
Multisig Approver:   0x61959e8238438b424c5f2da20565198e9ab13bd2c39dc0177a44c995384b12b
Reimbursement NFT:   0x2a53483832207462053a686cc3e92b64dcbe37632df65a3bf6d84b4934ddf06
Spending Analytics:  0x4c00f7ff43eb49044a1851f1d16402cb830abacd151cfd6cd3b78f2f9be49b3
Proof Verifier:      0x5db2db936c3ec8689cd31043572bbaec410f7275dc81381f9eaf84dae2a3d8e
```

## Setup

### Prerequisites

- Node.js 22+
- Scarb 2.16+ (for Cairo contracts)
- Google Cloud project with Gmail API enabled

### Install

```bash
cd web
npm install
```

### Environment Variables

Create `web/.env.local`:

```
STARKNET_NETWORK=sepolia
STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo
STARKNET_ACCOUNT_ADDRESS=<relayer-address>
STARKNET_PRIVATE_KEY=<relayer-private-key>
ADMIN_ACCOUNT_ADDRESS=<admin-address>
ADMIN_PRIVATE_KEY=<admin-private-key>

INVOICE_CONTRACT_ADDRESS=<deployed-address>
EMPLOYEE_REGISTRY_ADDRESS=<deployed-address>
TREASURY_ADDRESS=<deployed-address>
VENDOR_REGISTRY_ADDRESS=<deployed-address>
MULTISIG_ADDRESS=<deployed-address>
NFT_ADDRESS=<deployed-address>
ANALYTICS_ADDRESS=<deployed-address>
PROOF_VERIFIER_ADDRESS=<deployed-address>

GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run

```bash
cd web
npm run dev
```

### Compile Contracts

```bash
cd contracts
scarb build
```

### Deploy Contracts

```bash
cd web
node deploy-sepolia.mjs
```

## StarkZap Integration

StarkZap is what makes the payment side work. The company treasury holds one token (e.g., STRK). Each employee chooses their preferred token (USDC, ETH, STRK). When the admin pays:

1. StarkZap reads the employee's on-chain token preference
2. If different from treasury token, swaps via Avnu/Ekubo DEX
3. Transfers the swapped token to the employee
4. All in one flow

Without StarkZap, you'd need manual DEX swaps for each employee. With StarkZap, one click pays everyone in their preferred token.

## Privacy

- Raw email content stays server-side, never sent to the browser
- On-chain proof stores only a hash commitment (vendor + amount + timestamp + DKIM)
- Admin sees vendor, amount, date — not the email body
- Gmail access is readonly, scoped to the authorizing user only
- Refresh token stored in httpOnly cookie, inaccessible to JavaScript

## License

MIT
