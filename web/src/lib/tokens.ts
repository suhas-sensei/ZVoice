// Starknet Sepolia token addresses — client-safe, no SDK imports
export const SEPOLIA_TOKENS = {
  USDC: "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080",
  STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
} as const;

export const TOKEN_LABELS: Record<string, string> = {
  [SEPOLIA_TOKENS.USDC]: "USDC",
  [SEPOLIA_TOKENS.STRK]: "STRK",
  [SEPOLIA_TOKENS.ETH]: "ETH",
};
