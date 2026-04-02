import { RpcProvider, Account, Contract, CallData } from "starknet";
import type { Invoice } from "./types";
import { parseStatus, feltToShortString } from "./types";

// ── ABI: Invoice Registry (extended with policy engine) ──────────────

const INVOICE_ABI = [
  {
    type: "impl",
    name: "ZKInvoiceImpl",
    interface_name: "zkinvoice::invoice_registry::IZKInvoice",
  },
  {
    type: "interface",
    name: "zkinvoice::invoice_registry::IZKInvoice",
    items: [
      {
        type: "function",
        name: "submit_invoice",
        inputs: [
          { name: "invoice_hash", type: "core::felt252" },
          { name: "employee", type: "core::starknet::contract_address::ContractAddress" },
          { name: "vendor", type: "core::felt252" },
          { name: "amount_cents", type: "core::integer::u64" },
          { name: "timestamp", type: "core::integer::u64" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "approve_invoice",
        inputs: [{ name: "invoice_id", type: "core::integer::u64" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "reject_invoice",
        inputs: [{ name: "invoice_id", type: "core::integer::u64" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "batch_approve",
        inputs: [{ name: "invoice_ids", type: "core::array::Array::<core::integer::u64>" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "mark_paid",
        inputs: [
          { name: "invoice_id", type: "core::integer::u64" },
          { name: "payment_tx", type: "core::felt252" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_auto_approve_threshold",
        inputs: [{ name: "amount_cents", type: "core::integer::u64" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_monthly_cap",
        inputs: [{ name: "amount_cents", type: "core::integer::u64" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_auto_approve_threshold",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_monthly_cap",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_monthly_spend",
        inputs: [
          { name: "employee", type: "core::starknet::contract_address::ContractAddress" },
          { name: "month", type: "core::integer::u32" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "set_treasury",
        inputs: [{ name: "treasury", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_employee_registry",
        inputs: [{ name: "registry", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_invoice",
        inputs: [{ name: "invoice_id", type: "core::integer::u64" }],
        outputs: [
          {
            type: "(core::felt252, core::starknet::contract_address::ContractAddress, core::felt252, core::integer::u64, core::integer::u64, core::integer::u8, core::bool, core::felt252)",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_invoice_count",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_employee_invoice_count",
        inputs: [{ name: "employee", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_employee_invoice_id",
        inputs: [
          { name: "employee", type: "core::starknet::contract_address::ContractAddress" },
          { name: "index", type: "core::integer::u64" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_duplicate",
        inputs: [{ name: "invoice_hash", type: "core::felt252" }],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_admin",
        inputs: [],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_relayer",
        inputs: [],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      { name: "admin", type: "core::starknet::contract_address::ContractAddress" },
      { name: "relayer", type: "core::starknet::contract_address::ContractAddress" },
    ],
  },
] as const;

// ── ABI: Employee Registry ───────────────────────────────────────────

const EMPLOYEE_REGISTRY_ABI = [
  {
    type: "impl",
    name: "EmployeeRegistryImpl",
    interface_name: "zkinvoice::employee_registry::IEmployeeRegistry",
  },
  {
    type: "interface",
    name: "zkinvoice::employee_registry::IEmployeeRegistry",
    items: [
      {
        type: "function",
        name: "register_employee",
        inputs: [
          { name: "employee", type: "core::starknet::contract_address::ContractAddress" },
          { name: "preferred_token", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_preferred_token",
        inputs: [{ name: "token", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_preferred_token",
        inputs: [{ name: "employee", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_registered",
        inputs: [{ name: "employee", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_employee_count",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_employee_at",
        inputs: [{ name: "index", type: "core::integer::u64" }],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [{ name: "admin", type: "core::starknet::contract_address::ContractAddress" }],
  },
] as const;

// ── ABI: Treasury ────────────────────────────────────────────────────

const TREASURY_ABI = [
  {
    type: "impl",
    name: "TreasuryImpl",
    interface_name: "zkinvoice::treasury::ITreasury",
  },
  {
    type: "interface",
    name: "zkinvoice::treasury::ITreasury",
    items: [
      {
        type: "function",
        name: "deposit",
        inputs: [
          { name: "token", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "disburse",
        inputs: [
          { name: "employee", type: "core::starknet::contract_address::ContractAddress" },
          { name: "amount", type: "core::integer::u256" },
          { name: "token", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "batch_disburse",
        inputs: [
          { name: "employees", type: "core::array::Array::<core::starknet::contract_address::ContractAddress>" },
          { name: "amounts", type: "core::array::Array::<core::integer::u256>" },
          { name: "tokens", type: "core::array::Array::<core::starknet::contract_address::ContractAddress>" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_treasury_token",
        inputs: [{ name: "token", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "set_authorized_caller",
        inputs: [{ name: "caller", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_treasury_token",
        inputs: [],
        outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_balance",
        inputs: [{ name: "token", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_total_disbursed",
        inputs: [],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_employee_total_disbursed",
        inputs: [{ name: "employee", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      { name: "admin", type: "core::starknet::contract_address::ContractAddress" },
      { name: "treasury_token", type: "core::starknet::contract_address::ContractAddress" },
    ],
  },
] as const;

// ── Providers & Accounts ─────────────────────────────────────────────

function getProvider(): RpcProvider {
  return new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL || "https://starknet-sepolia.public.blastapi.io",
  });
}

function getRelayerAccount(): Account {
  return new Account({
    provider: getProvider(),
    address: process.env.STARKNET_ACCOUNT_ADDRESS!,
    signer: process.env.STARKNET_PRIVATE_KEY!,
  });
}

function getAdminAccount(): Account {
  return new Account({
    provider: getProvider(),
    address: process.env.ADMIN_ACCOUNT_ADDRESS || process.env.STARKNET_ACCOUNT_ADDRESS!,
    signer: process.env.ADMIN_PRIVATE_KEY || process.env.STARKNET_PRIVATE_KEY!,
  });
}

function getInvoiceContract(connectAccount = false): Contract {
  return new Contract({
    abi: INVOICE_ABI as unknown as import("starknet").Abi,
    address: process.env.INVOICE_CONTRACT_ADDRESS!,
    providerOrAccount: connectAccount ? getRelayerAccount() : getProvider(),
  });
}

function getEmployeeRegistryContract(): Contract {
  return new Contract({
    abi: EMPLOYEE_REGISTRY_ABI as unknown as import("starknet").Abi,
    address: process.env.EMPLOYEE_REGISTRY_ADDRESS!,
    providerOrAccount: getProvider(),
  });
}

function getTreasuryContract(): Contract {
  return new Contract({
    abi: TREASURY_ABI as unknown as import("starknet").Abi,
    address: process.env.TREASURY_ADDRESS!,
    providerOrAccount: getProvider(),
  });
}

// ── Invoice Registry Operations ──────────────────────────────────────

export async function submitInvoiceOnChain(params: {
  invoiceHash: string;
  employee: string;
  vendor: string;
  amountCents: number;
  timestamp: number;
}): Promise<{ invoiceId: number; txHash: string }> {
  const account = getRelayerAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  const calldata = CallData.compile({
    invoice_hash: params.invoiceHash,
    employee: params.employee,
    vendor: params.vendor,
    amount_cents: params.amountCents,
    timestamp: params.timestamp,
  });

  const result = await account.execute({
    contractAddress,
    entrypoint: "submit_invoice",
    calldata,
  });

  await account.waitForTransaction(result.transaction_hash);

  const contract = getInvoiceContract();
  const count = await contract.call("get_invoice_count");
  const invoiceId = Number(count) - 1;

  return { invoiceId, txHash: result.transaction_hash };
}

export async function approveInvoiceOnChain(invoiceId: number): Promise<string> {
  const account = getAdminAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "approve_invoice",
    calldata: CallData.compile({ invoice_id: invoiceId }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

export async function batchApproveOnChain(invoiceIds: number[]): Promise<string> {
  const account = getAdminAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "batch_approve",
    calldata: CallData.compile({ invoice_ids: invoiceIds }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

export async function rejectInvoiceOnChain(invoiceId: number): Promise<string> {
  const account = getAdminAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "reject_invoice",
    calldata: CallData.compile({ invoice_id: invoiceId }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

export async function markPaidOnChain(invoiceId: number, paymentTx: string): Promise<string> {
  const account = getRelayerAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "mark_paid",
    calldata: CallData.compile({ invoice_id: invoiceId, payment_tx: paymentTx }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

// ── Policy Engine ────────────────────────────────────────────────────

export async function setAutoApproveThreshold(amountCents: number): Promise<string> {
  const account = getAdminAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "set_auto_approve_threshold",
    calldata: CallData.compile({ amount_cents: amountCents }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

export async function setMonthlyCap(amountCents: number): Promise<string> {
  const account = getAdminAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "set_monthly_cap",
    calldata: CallData.compile({ amount_cents: amountCents }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

export async function getPolicy(): Promise<{ threshold: number; monthlyCap: number }> {
  const contract = getInvoiceContract();
  const threshold = Number(await contract.call("get_auto_approve_threshold"));
  const monthlyCap = Number(await contract.call("get_monthly_cap"));
  return { threshold, monthlyCap };
}

// ── Invoice Reads ────────────────────────────────────────────────────

export async function getInvoices(): Promise<Invoice[]> {
  const contract = getInvoiceContract();
  const count = Number(await contract.call("get_invoice_count"));
  const invoices: Invoice[] = [];

  for (let i = 0; i < count; i++) {
    const raw = (await contract.call("get_invoice", [i])) as unknown as [
      bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint
    ];

    invoices.push({
      id: i,
      invoiceHash: "0x" + raw[0].toString(16),
      employee: "0x" + raw[1].toString(16),
      vendor: feltToShortString(raw[2]),
      amountCents: Number(raw[3]),
      timestamp: Number(raw[4]),
      status: parseStatus(Number(raw[5])),
      proofVerified: raw[6],
      paymentTx: raw[7] === 0n ? "" : "0x" + raw[7].toString(16),
    });
  }

  return invoices;
}

export async function getEmployeeInvoices(employee: string): Promise<Invoice[]> {
  const contract = getInvoiceContract();
  const count = Number(await contract.call("get_employee_invoice_count", [employee]));
  const invoices: Invoice[] = [];

  for (let i = 0; i < count; i++) {
    const invoiceId = Number(await contract.call("get_employee_invoice_id", [employee, i]));
    const raw = (await contract.call("get_invoice", [invoiceId])) as unknown as [
      bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint
    ];

    invoices.push({
      id: invoiceId,
      invoiceHash: "0x" + raw[0].toString(16),
      employee: "0x" + raw[1].toString(16),
      vendor: feltToShortString(raw[2]),
      amountCents: Number(raw[3]),
      timestamp: Number(raw[4]),
      status: parseStatus(Number(raw[5])),
      proofVerified: raw[6],
      paymentTx: raw[7] === 0n ? "" : "0x" + raw[7].toString(16),
    });
  }

  return invoices;
}

// ── Employee Registry ────────────────────────────────────────────────

export async function getPreferredToken(employee: string): Promise<string> {
  const contract = getEmployeeRegistryContract();
  const token = await contract.call("get_preferred_token", [employee]);
  return "0x" + (token as bigint).toString(16);
}

export async function isEmployeeRegistered(employee: string): Promise<boolean> {
  const contract = getEmployeeRegistryContract();
  return (await contract.call("is_registered", [employee])) as boolean;
}

export async function registerEmployeeOnChain(employee: string, preferredToken: string): Promise<string> {
  const account = getAdminAccount();
  const contractAddress = process.env.EMPLOYEE_REGISTRY_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "register_employee",
    calldata: CallData.compile({ employee, preferred_token: preferredToken }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

export async function setPreferredTokenOnChain(employee: string, token: string): Promise<string> {
  // This must be called by the employee themselves (contract checks caller == employee)
  // For hackathon: use admin account since Cartridge wallet can't sign server-side
  const account = getAdminAccount();
  const contractAddress = process.env.EMPLOYEE_REGISTRY_ADDRESS!;

  // First check if registered, if not register them
  try {
    const registered = await isEmployeeRegistered(employee);
    if (!registered) {
      await registerEmployeeOnChain(employee, token);
      return "registered";
    }
  } catch { /* continue */ }

  // Update preferred token — NOTE: contract requires caller == employee
  // For hackathon demo, we store it off-chain and read it during payment
  const result = await account.execute({
    contractAddress,
    entrypoint: "set_preferred_token",
    calldata: CallData.compile({ token }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

// ── Treasury Reads ───────────────────────────────────────────────────

export async function getTreasuryBalance(token: string): Promise<bigint> {
  const contract = getTreasuryContract();
  return (await contract.call("get_balance", [token])) as bigint;
}

export async function getTotalDisbursed(): Promise<bigint> {
  const contract = getTreasuryContract();
  return (await contract.call("get_total_disbursed")) as bigint;
}

// ── Reimbursement NFT ────────────────────────────────────────────────

export async function mintReceiptNFT(params: {
  employee: string;
  invoiceId: number;
  vendor: string;
  amountCents: number;
  paymentTx: string;
  timestamp: number;
}): Promise<{ txHash: string; tokenId: string }> {
  const account = getAdminAccount();
  const contractAddress = process.env.NFT_ADDRESS!;

  const result = await account.execute({
    contractAddress,
    entrypoint: "mint_receipt",
    calldata: CallData.compile({
      employee: params.employee,
      invoice_id: params.invoiceId,
      vendor: params.vendor,
      amount_cents: params.amountCents,
      payment_tx: params.paymentTx,
      timestamp: params.timestamp,
    }),
  });

  await account.waitForTransaction(result.transaction_hash);

  // Get the token ID from the receipt (it's the return value)
  const receipt = await getProvider().getTransactionReceipt(result.transaction_hash);
  // The mint function returns the token_id, extract from events
  let tokenId = "0";
  for (const event of receipt.events || []) {
    // ReceiptMinted event has token_id as first key
    if (event.keys && event.keys.length >= 2) {
      tokenId = event.keys[1] || "0";
      break;
    }
  }

  return { txHash: result.transaction_hash, tokenId };
}
