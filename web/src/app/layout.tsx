import type { Metadata } from "next";
import { CartridgeProvider } from "@/components/CartridgeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZVoice - Privacy-Preserving Invoice Reimbursement",
  description:
    "ZK-powered corporate invoice verification and reimbursement on StarkNet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}
      >
        <CartridgeProvider>
          {children}
        </CartridgeProvider>
      </body>
    </html>
  );
}
