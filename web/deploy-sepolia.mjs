import { RpcProvider, Account, json, CallData, hash, ec, stark } from "starknet";
import fs from "fs";
import path from "path";

const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/demo";
const CONTRACTS_DIR = path.resolve("../contracts/target/dev");

const DEPLOYER_PK = "0x2c5fb18e866b3eeb0c9f5bef9b8c99456340314148e9c715e6c88f23f11c688";
const DEPLOYER_PUBKEY = "0x32bc131df8ca9f1547af80add73baeaffe13aaeae7a43862b5b00317dc7a159";
const DEPLOYER_ADDR = "0x170e8feeed243d7362b2dfee98502e73187bdac891daa1201c9e56c2a96af9b";
const OZ_CLASS = "0x02b31e19e45c06f29234e06e2ee98a9966479ba3067f8785ed972794fdb0065c";

// UDC on Sepolia
const UDC_ADDRESS = "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf";

const USDC_SEPOLIA = "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080";

const provider = new RpcProvider({ nodeUrl: RPC_URL });

async function deployAccountIfNeeded() {
  try {
    const nonce = await provider.getNonceForAddress(DEPLOYER_ADDR);
    console.log("Account already deployed, nonce:", nonce);
    return;
  } catch {
    console.log("Deploying account on Sepolia...");
    const account = new Account({ provider, address: DEPLOYER_ADDR, signer: DEPLOYER_PK });
    const { transaction_hash } = await account.deployAccount({
      classHash: OZ_CLASS,
      constructorCalldata: [DEPLOYER_PUBKEY],
      addressSalt: DEPLOYER_PUBKEY,
    });
    console.log("  Deploy account tx:", transaction_hash);
    await provider.waitForTransaction(transaction_hash);
    console.log("  Account deployed!");
  }
}

const admin = new Account({ provider, address: DEPLOYER_ADDR, signer: DEPLOYER_PK });

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

  console.log(`  Deploying ${name}...`);
  const salt = "0x" + Math.floor(Math.random() * 0xffffffff).toString(16);
  const compiledCalldata = CallData.compile(constructorArgs);

  const result = await admin.execute({
    contractAddress: UDC_ADDRESS,
    entrypoint: "deployContract",
    calldata: [
      classHash,
      salt,
      "0x0",
      compiledCalldata.length.toString(),
      ...compiledCalldata,
    ],
  });
  await provider.waitForTransaction(result.transaction_hash);

  const receipt = await provider.getTransactionReceipt(result.transaction_hash);
  let contractAddress = "unknown";
  for (const event of (receipt.events || [])) {
    if (event.from_address?.toLowerCase() === UDC_ADDRESS.toLowerCase()) {
      contractAddress = event.data?.[0] || "unknown";
      break;
    }
  }
  if (contractAddress === "unknown" && receipt.events?.length > 0) {
    contractAddress = receipt.events[0].data?.[0] || "unknown";
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
  console.log("=== DEPLOYING TO STARKNET SEPOLIA ===\n");

  await deployAccountIfNeeded();

  console.log("\n--- Declaring & deploying 8 contracts ---\n");

  // Use same address as both admin and relayer for Sepolia (single deployer key)
  const employeeRegistry = await declareAndDeploy("EmployeeRegistry", [DEPLOYER_ADDR]);
  const treasury = await declareAndDeploy("Treasury", [DEPLOYER_ADDR, USDC_SEPOLIA]);
  const invoiceRegistry = await declareAndDeploy("ZKInvoice", [DEPLOYER_ADDR, DEPLOYER_ADDR]);
  const vendorRegistry = await declareAndDeploy("VendorRegistry", [DEPLOYER_ADDR]);
  const multisig = await declareAndDeploy("MultisigApprover", [DEPLOYER_ADDR, "2", "50000"]);
  const nft = await declareAndDeploy("ReimbursementNFT", [DEPLOYER_ADDR]);
  const analytics = await declareAndDeploy("SpendingAnalytics", [DEPLOYER_ADDR]);
  const proofVerifier = await declareAndDeploy("ProofVerifier", [DEPLOYER_ADDR]);

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
  await invoke(proofVerifier.address, "set_authorized_submitter", { submitter: DEPLOYER_ADDR });

  console.log("  nft.set_authorized_minter...");
  await invoke(nft.address, "set_authorized_minter", { minter: invoiceRegistry.address });

  console.log("  set auto_approve_threshold to $50...");
  await invoke(invoiceRegistry.address, "set_auto_approve_threshold", { amount_cents: "5000" });

  console.log("  set monthly_cap to $1000...");
  await invoke(invoiceRegistry.address, "set_monthly_cap", { amount_cents: "100000" });

  console.log("\n=== ALL DEPLOYED AND WIRED ON SEPOLIA ===\n");

  const envContent = `# Starknet Sepolia deployment
STARKNET_NETWORK=sepolia
STARKNET_RPC_URL=${RPC_URL}

# Deployer account (admin + relayer on Sepolia)
STARKNET_ACCOUNT_ADDRESS=${DEPLOYER_ADDR}
STARKNET_PRIVATE_KEY=${DEPLOYER_PK}
ADMIN_ACCOUNT_ADDRESS=${DEPLOYER_ADDR}
ADMIN_PRIVATE_KEY=${DEPLOYER_PK}

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
ADMIN_ADDRESSES=${DEPLOYER_ADDR}

# Gmail OAuth (fill in your credentials)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

  fs.writeFileSync(".env.local", envContent);
  console.log("Wrote .env.local for Sepolia\n");

  console.log("Contract addresses:");
  console.log("  INVOICE_CONTRACT_ADDRESS=" + invoiceRegistry.address);
  console.log("  EMPLOYEE_REGISTRY_ADDRESS=" + employeeRegistry.address);
  console.log("  TREASURY_ADDRESS=" + treasury.address);
  console.log("  VENDOR_REGISTRY_ADDRESS=" + vendorRegistry.address);
  console.log("  MULTISIG_ADDRESS=" + multisig.address);
  console.log("  NFT_ADDRESS=" + nft.address);
  console.log("  ANALYTICS_ADDRESS=" + analytics.address);
  console.log("  PROOF_VERIFIER_ADDRESS=" + proofVerifier.address);
}

main().catch((e) => {
  console.error("Deploy failed:", e.message || e);
  process.exit(1);
});
