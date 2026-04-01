import {
  StarkZap,
  StarkSigner,
  AvnuSwapProvider,
  EkuboSwapProvider,
  Amount,
} from "starkzap";

// Sepolia token addresses
const SEPOLIA_TOKENS = {
  STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  USDC: "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080",
};

type WalletInstance = Awaited<ReturnType<StarkZap["connectWallet"]>>;

let walletInstance: WalletInstance | null = null;

async function getPaymentWallet(): Promise<WalletInstance> {
  if (walletInstance) return walletInstance;

  const sdk = new StarkZap({ network: "sepolia" });
  const signer = new StarkSigner(process.env.STARKNET_PRIVATE_KEY!);

  const wallet = await sdk.connectWallet({
    account: {
      signer,
      deployIfNeeded: "if_needed",
    },
    swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
  });

  walletInstance = wallet;
  return wallet;
}

export async function payEmployee(params: {
  employeeAddress: string;
  amountCents: number;
  preferredToken?: string;
}): Promise<{ txHash: string }> {
  const wallet = await getPaymentWallet();
  const amountUsd = (params.amountCents / 100).toFixed(2);

  const tokenAddress = params.preferredToken || SEPOLIA_TOKENS.USDC;

  // If paying in USDC (default), direct transfer
  if (
    tokenAddress.toLowerCase() === SEPOLIA_TOKENS.USDC.toLowerCase() ||
    !params.preferredToken
  ) {
    const tx = await wallet
      .tx()
      .transfer(SEPOLIA_TOKENS.USDC, [
        {
          to: params.employeeAddress,
          amount: Amount.parse(amountUsd, SEPOLIA_TOKENS.USDC),
        },
      ])
      .send({ feeMode: "user_pays" });

    await tx.wait();
    return { txHash: tx.hash };
  }

  // Swap from treasury USDC to preferred token, then transfer
  const tx = await wallet
    .tx()
    .swap(SEPOLIA_TOKENS.USDC, tokenAddress, Amount.parse(amountUsd, SEPOLIA_TOKENS.USDC), {
      slippageBps: 100,
    })
    .transfer(tokenAddress, [
      {
        to: params.employeeAddress,
        amount: Amount.parse(amountUsd, tokenAddress),
      },
    ])
    .send({ feeMode: "user_pays" });

  await tx.wait();
  return { txHash: tx.hash };
}

export async function batchPayEmployees(
  payments: Array<{
    employeeAddress: string;
    amountCents: number;
  }>
): Promise<{ txHash: string }> {
  const wallet = await getPaymentWallet();

  const transfers = payments.map((p) => ({
    to: p.employeeAddress,
    amount: Amount.parse(
      (p.amountCents / 100).toFixed(2),
      SEPOLIA_TOKENS.USDC
    ),
  }));

  const tx = await wallet
    .tx()
    .transfer(SEPOLIA_TOKENS.USDC, transfers)
    .send({ feeMode: "user_pays" });

  await tx.wait();
  return { txHash: tx.hash };
}

export { SEPOLIA_TOKENS };
