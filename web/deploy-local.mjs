import { RpcProvider, Account, json, CallData } from "starknet";
import fs from "fs";
import path from "path";

const RPC_URL = "http://localhost:5050";
const CONTRACTS_DIR = path.resolve("../contracts/target/dev");

// Devnet UDC address
const UDC_ADDRESS = "0x41A78E741E5AF2FEC34B695679BC6891742439F7AFB8484ECD7766661AD02BF";

// Devnet pre-funded accounts (seed=0)
const ADMIN = {
  address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691",
  privateKey: "0x71d7bb07b9a64f6f78ac4c816aff4da9",
};

const RELAYER = {
  address: "0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1",
  privateKey: "0x0e1406455b7d66b1690803be066cbe5e",
};

const ETH_TOKEN = "0x49D36570D4E46F48E99674BD3FCC84644DDD6B96F7C741B1562B82F9E004DC7";

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const admin = new Account({ provider, address: ADMIN.address, signer: ADMIN.privateKey });

async function declareAndDeploy(name, constructorArgs) {
  const sierraPath = path.join(CONTRACTS_DIR, `zkinvoice_${name}.contract_class.json`);
  const casmPath = path.join(CONTRACTS_DIR, `zkinvoice_${name}.compiled_contract_class.json`);

  const sierra = json.parse(fs.readFileSync(sierraPath).toString());
  const casm = json.parse(fs.readFileSync(casmPath).toString());

  console.log(`  Declaring ${name}...`);
  const declareResponse = await admin.declareIfNot({ contract: sierra, casm });
  if (declareResponse.transaction_hash) {
    await provider.waitForTransaction(declareResponse.transaction_hash);
  }
  const classHash = declareResponse.class_hash;
  console.log(`    Class hash: ${classHash}`);

  // Deploy via UDC (devnet's predeployed UDC)
  console.log(`  Deploying ${name}...`);
  const salt = "0x" + Math.floor(Math.random() * 0xffffffff).toString(16);
  const compiledCalldata = CallData.compile(constructorArgs);

  const result = await admin.execute({
    contractAddress: UDC_ADDRESS,
    entrypoint: "deployContract",
    calldata: [
      classHash,           // class hash
      salt,                // salt
      "0x0",               // unique (false)
      compiledCalldata.length.toString(), // constructor calldata length
      ...compiledCalldata, // constructor calldata
    ],
  });
  await provider.waitForTransaction(result.transaction_hash);

  // Get deployed address from transaction receipt events
  const receipt = await provider.getTransactionReceipt(result.transaction_hash);
  // Try multiple ways to find the deployed address
  let contractAddress = "unknown";
  for (const event of (receipt.events || [])) {
    // UDC ContractDeployed event has address in data[0]
    if (event.from_address?.toLowerCase() === UDC_ADDRESS.toLowerCase()) {
      contractAddress = event.data?.[0] || event.keys?.[1] || "unknown";
      break;
    }
  }
  // Fallback: scan all events for any address-like data
  if (contractAddress === "unknown" && receipt.events?.length > 0) {
    // The first event from UDC usually contains the deployed address
    const firstEvent = receipt.events[0];
    contractAddress = firstEvent.data?.[0] || firstEvent.keys?.[0] || "unknown";
    // Log all events for debugging
    console.log(`    Events: ${JSON.stringify(receipt.events.map(e => ({from: e.from_address, keys: e.keys, data: e.data})))}`);
  }
  console.log(`    Address: ${contractAddress}`);
  console.log(`    Tx: ${result.transaction_hash}`);

  return { classHash, address: contractAddress };
}

async function invoke(contractAddress, entrypoint, calldata) {
  const result = await admin.execute({
    contractAddress,
    entrypoint,
    calldata: CallData.compile(calldata),
  });
  await provider.waitForTransaction(result.transaction_hash);
  return result.transaction_hash;
}

async function main() {
  console.log("=== DEPLOYING ALL 8 CONTRACTS ===\n");

  const employeeRegistry = await declareAndDeploy("EmployeeRegistry", [ADMIN.address]);
  const treasury = await declareAndDeploy("Treasury", [ADMIN.address, ETH_TOKEN]);
  const invoiceRegistry = await declareAndDeploy("ZKInvoice", [ADMIN.address, RELAYER.address]);
  const vendorRegistry = await declareAndDeploy("VendorRegistry", [ADMIN.address]);
  const multisig = await declareAndDeploy("MultisigApprover", [ADMIN.address, "2", "50000"]);
  const nft = await declareAndDeploy("ReimbursementNFT", [ADMIN.address]);
  const analytics = await declareAndDeploy("SpendingAnalytics", [ADMIN.address]);
  const proofVerifier = await declareAndDeploy("ProofVerifier", [ADMIN.address]);

  console.log("\n=== WIRING CONTRACTS ===\n");

  console.log("  invoice_registry.set_treasury...");
  await invoke(invoiceRegistry.address, "set_treasury", { treasury: treasury.address });

  console.log("  invoice_registry.set_employee_registry...");
  await invoke(invoiceRegistry.address, "set_employee_registry", { registry: employeeRegistry.address });

  console.log("  treasury.set_authorized_caller...");
  await invoke(treasury.address, "set_authorized_caller", { caller: invoiceRegistry.address });

  console.log("  vendor_registry.set_authorized_caller...");
  await invoke(vendorRegistry.address, "set_authorized_caller", { caller: invoiceRegistry.address });

  console.log("  analytics.set_authorized_caller...");
  await invoke(analytics.address, "set_authorized_caller", { caller: invoiceRegistry.address });

  console.log("  proof_verifier.set_authorized_submitter...");
  await invoke(proofVerifier.address, "set_authorized_submitter", { submitter: RELAYER.address });

  console.log("  nft.set_authorized_minter...");
  await invoke(nft.address, "set_authorized_minter", { minter: invoiceRegistry.address });

  console.log("  set auto_approve_threshold to $50...");
  await invoke(invoiceRegistry.address, "set_auto_approve_threshold", { amount_cents: "5000" });

  console.log("  set monthly_cap to $1000...");
  await invoke(invoiceRegistry.address, "set_monthly_cap", { amount_cents: "100000" });

  console.log("\n=== ALL DEPLOYED AND WIRED ===\n");

  const envContent = `# Auto-generated by deploy-local.mjs
# Starknet devnet (localhost:5050, seed=0)
STARKNET_NETWORK=devnet
STARKNET_RPC_URL=http://localhost:5050

# Relayer account (devnet account 1 - submits invoices)
STARKNET_ACCOUNT_ADDRESS=${RELAYER.address}
STARKNET_PRIVATE_KEY=${RELAYER.privateKey}

# Contract addresses
INVOICE_CONTRACT_ADDRESS=${invoiceRegistry.address}
EMPLOYEE_REGISTRY_ADDRESS=${employeeRegistry.address}
TREASURY_ADDRESS=${treasury.address}
VENDOR_REGISTRY_ADDRESS=${vendorRegistry.address}
MULTISIG_ADDRESS=${multisig.address}
NFT_ADDRESS=${nft.address}
ANALYTICS_ADDRESS=${analytics.address}
PROOF_VERIFIER_ADDRESS=${proofVerifier.address}

# Admin addresses
ADMIN_ADDRESSES=${ADMIN.address}

# Gmail (fill in for email scanning)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

  fs.writeFileSync(".env.local", envContent);
  console.log("Wrote .env.local\n");

  console.log("Contract addresses:");
  console.log(`  INVOICE_CONTRACT_ADDRESS=${invoiceRegistry.address}`);
  console.log(`  EMPLOYEE_REGISTRY_ADDRESS=${employeeRegistry.address}`);
  console.log(`  TREASURY_ADDRESS=${treasury.address}`);
  console.log(`  VENDOR_REGISTRY_ADDRESS=${vendorRegistry.address}`);
  console.log(`  MULTISIG_ADDRESS=${multisig.address}`);
  console.log(`  NFT_ADDRESS=${nft.address}`);
  console.log(`  ANALYTICS_ADDRESS=${analytics.address}`);
  console.log(`  PROOF_VERIFIER_ADDRESS=${proofVerifier.address}`);
}

main().catch((e) => {
  console.error("Deploy failed:", e.message || e);
  process.exit(1);
});
