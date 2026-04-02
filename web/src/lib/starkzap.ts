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

// Treasury holds STRK. StarkZap swaps to employee's preferred token.
const TREASURY_TOKEN = STRK as Token;

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
  if (!addressOrUndefined) return STRK as Token;
  const token = TOKEN_BY_ADDRESS[addressOrUndefined.toLowerCase()];
  return token ?? (STRK as Token);
}

export async function payEmployee(params: {
  employeeAddress: string;
  amountCents: number;
  preferredToken?: string;
}): Promise<{ txHash: string }> {
  const wallet = await getPaymentWallet();
  // Convert cents to token amount (1:1 for testnet simplicity)
  const amount = (params.amountCents / 100).toFixed(6);
  const targetToken = resolveToken(params.preferredToken);

  // If employee wants STRK (same as treasury), direct transfer
  if (targetToken.address.toLowerCase() === TREASURY_TOKEN.address.toLowerCase()) {
    const tx = await wallet.transfer(TREASURY_TOKEN, [
      {
        to: fromAddress(params.employeeAddress),
        amount: Amount.parse(amount, TREASURY_TOKEN),
      },
    ]);
    await tx.wait();
    return { txHash: tx.hash };
  }

  // Employee wants a different token — swap STRK → preferred token via StarkZap
  const swapTx = await wallet.swap(
    {
      tokenIn: TREASURY_TOKEN,
      tokenOut: targetToken,
      amountIn: Amount.parse(amount, TREASURY_TOKEN),
      slippageBps: 300n, // 3% slippage for testnet
    },
    { feeMode: "user_pays" }
  );
  await swapTx.wait();

  // Transfer the swapped token to employee
  const transferTx = await wallet.transfer(targetToken, [
    {
      to: fromAddress(params.employeeAddress),
      amount: Amount.parse(amount, targetToken),
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

  // Batch transfer in STRK (treasury token)
  const transfers = payments.map((p) => ({
    to: fromAddress(p.employeeAddress),
    amount: Amount.parse((p.amountCents / 100).toFixed(6), TREASURY_TOKEN),
  }));

  const tx = await wallet.transfer(TREASURY_TOKEN, transfers);
  await tx.wait();
  return { txHash: tx.hash };
}

export const SEPOLIA_TOKENS = {
  STRK: (STRK as Token).address,
  ETH: (ETH as Token).address,
  USDC: (USDC as Token).address,
};
