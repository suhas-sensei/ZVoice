import {
  StarkZap,
  StarkSigner,
  AvnuSwapProvider,
  EkuboSwapProvider,
  Amount,
  sepoliaTokens,
} from "starkzap";
import type { Token } from "starkzap";
import { fromAddress } from "starkzap";

const { STRK, ETH, USDC } = sepoliaTokens;

const TOKEN_BY_ADDRESS: Record<string, Token> = {
  [(STRK as Token).address.toLowerCase()]: STRK as Token,
  [(ETH as Token).address.toLowerCase()]: ETH as Token,
  [(USDC as Token).address.toLowerCase()]: USDC as Token,
};

type WalletInstance = Awaited<ReturnType<StarkZap["connectWallet"]>>;

let walletInstance: WalletInstance | null = null;

async function getPaymentWallet(): Promise<WalletInstance> {
  if (walletInstance) return walletInstance;

  const sdk = new StarkZap({ network: "sepolia" });
  const signer = new StarkSigner(process.env.STARKNET_PRIVATE_KEY!);

  const wallet = await sdk.connectWallet({
    account: { signer },
    swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
  });

  await wallet.ensureReady({ deploy: "if_needed" });

  walletInstance = wallet;
  return wallet;
}

function resolveToken(addressOrUndefined?: string): Token {
  if (!addressOrUndefined) return USDC as Token;
  const token = TOKEN_BY_ADDRESS[addressOrUndefined.toLowerCase()];
  return token ?? (USDC as Token);
}

export async function payEmployee(params: {
  employeeAddress: string;
  amountCents: number;
  preferredToken?: string;
}): Promise<{ txHash: string }> {
  const wallet = await getPaymentWallet();
  const amountUsd = (params.amountCents / 100).toFixed(2);
  const targetToken = resolveToken(params.preferredToken);
  const usdcToken = USDC as Token;

  if (targetToken.address === usdcToken.address) {
    const tx = await wallet.transfer(usdcToken, [
      {
        to: fromAddress(params.employeeAddress),
        amount: Amount.parse(amountUsd, usdcToken),
      },
    ]);
    await tx.wait();
    return { txHash: tx.hash };
  }

  // Swap from treasury USDC to preferred token, then transfer
  const swapTx = await wallet.swap(
    {
      tokenIn: usdcToken,
      tokenOut: targetToken,
      amountIn: Amount.parse(amountUsd, usdcToken),
      slippageBps: 100n,
    },
    { feeMode: "user_pays" }
  );
  await swapTx.wait();

  const transferTx = await wallet.transfer(targetToken, [
    {
      to: fromAddress(params.employeeAddress),
      amount: Amount.parse(amountUsd, targetToken),
    },
  ]);
  await transferTx.wait();

  return { txHash: transferTx.hash };
}

export async function batchPayEmployees(
  payments: Array<{
    employeeAddress: string;
    amountCents: number;
  }>
): Promise<{ txHash: string }> {
  const wallet = await getPaymentWallet();
  const usdcToken = USDC as Token;

  const transfers = payments.map((p) => ({
    to: fromAddress(p.employeeAddress),
    amount: Amount.parse((p.amountCents / 100).toFixed(2), usdcToken),
  }));

  const tx = await wallet.transfer(usdcToken, transfers);
  await tx.wait();
  return { txHash: tx.hash };
}

export const SEPOLIA_TOKENS = {
  STRK: (STRK as Token).address,
  ETH: (ETH as Token).address,
  USDC: (USDC as Token).address,
};
