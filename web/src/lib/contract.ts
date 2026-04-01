import { RpcProvider, Account, Contract, CallData } from "starknet";
import type { Invoice } from "./types";
import { parseStatus, feltToShortString } from "./types";

const ABI = [
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
          {
            name: "employee",
            type: "core::starknet::contract_address::ContractAddress",
          },
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
        inputs: [
          {
            name: "employee",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_employee_invoice_id",
        inputs: [
          {
            name: "employee",
            type: "core::starknet::contract_address::ContractAddress",
          },
          { name: "index", type: "core::integer::u64" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_admin",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_relayer",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      {
        name: "admin",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "relayer",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    type: "event",
    name: "zkinvoice::invoice_registry::ZKInvoice::InvoiceSubmitted",
    kind: "struct",
    members: [
      {
        name: "invoice_id",
        type: "core::integer::u64",
        kind: "key",
      },
      {
        name: "employee",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
      { name: "vendor", type: "core::felt252", kind: "data" },
      {
        name: "amount_cents",
        type: "core::integer::u64",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "zkinvoice::invoice_registry::ZKInvoice::InvoiceApproved",
    kind: "struct",
    members: [
      {
        name: "invoice_id",
        type: "core::integer::u64",
        kind: "key",
      },
    ],
  },
  {
    type: "event",
    name: "zkinvoice::invoice_registry::ZKInvoice::InvoiceRejected",
    kind: "struct",
    members: [
      {
        name: "invoice_id",
        type: "core::integer::u64",
        kind: "key",
      },
    ],
  },
  {
    type: "event",
    name: "zkinvoice::invoice_registry::ZKInvoice::InvoicePaid",
    kind: "struct",
    members: [
      {
        name: "invoice_id",
        type: "core::integer::u64",
        kind: "key",
      },
      {
        name: "payment_tx",
        type: "core::felt252",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "zkinvoice::invoice_registry::ZKInvoice::Event",
    kind: "enum",
    variants: [
      {
        name: "InvoiceSubmitted",
        type: "zkinvoice::invoice_registry::ZKInvoice::InvoiceSubmitted",
        kind: "nested",
      },
      {
        name: "InvoiceApproved",
        type: "zkinvoice::invoice_registry::ZKInvoice::InvoiceApproved",
        kind: "nested",
      },
      {
        name: "InvoiceRejected",
        type: "zkinvoice::invoice_registry::ZKInvoice::InvoiceRejected",
        kind: "nested",
      },
      {
        name: "InvoicePaid",
        type: "zkinvoice::invoice_registry::ZKInvoice::InvoicePaid",
        kind: "nested",
      },
    ],
  },
] as const;

function getProvider(): RpcProvider {
  return new RpcProvider({
    nodeUrl: "https://starknet-sepolia.public.blastapi.io",
  });
}

function getRelayerAccount(): Account {
  return new Account({
    provider: getProvider(),
    address: process.env.STARKNET_ACCOUNT_ADDRESS!,
    signer: process.env.STARKNET_PRIVATE_KEY!,
  });
}

function getContract(connectAccount = false): Contract {
  const contract = new Contract({
    abi: ABI as unknown as import("starknet").Abi,
    address: process.env.INVOICE_CONTRACT_ADDRESS!,
    providerOrAccount: connectAccount ? getRelayerAccount() : getProvider(),
  });
  return contract;
}

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

  const contract = getContract();
  const count = await contract.call("get_invoice_count");
  const invoiceId = Number(count) - 1;

  return { invoiceId, txHash: result.transaction_hash };
}

export async function approveInvoiceOnChain(
  invoiceId: number
): Promise<string> {
  const account = getRelayerAccount();
  const contractAddress = process.env.INVOICE_CONTRACT_ADDRESS!;

  // Note: In production, admin would sign directly. For hackathon,
  // the relayer account acts as admin if configured as such.
  const result = await account.execute({
    contractAddress,
    entrypoint: "approve_invoice",
    calldata: CallData.compile({ invoice_id: invoiceId }),
  });

  await account.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

export async function markPaidOnChain(
  invoiceId: number,
  paymentTx: string
): Promise<string> {
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

export async function getInvoices(): Promise<Invoice[]> {
  const contract = getContract();
  const count = Number(await contract.call("get_invoice_count"));
  const invoices: Invoice[] = [];

  for (let i = 0; i < count; i++) {
    const raw = (await contract.call("get_invoice", [i])) as unknown as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
      bigint
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

export async function getEmployeeInvoices(
  employee: string
): Promise<Invoice[]> {
  const contract = getContract();
  const count = Number(
    await contract.call("get_employee_invoice_count", [employee])
  );
  const invoices: Invoice[] = [];

  for (let i = 0; i < count; i++) {
    const invoiceId = Number(
      await contract.call("get_employee_invoice_id", [employee, i])
    );

    const raw = (await contract.call("get_invoice", [
      invoiceId,
    ])) as unknown as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
      bigint
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
