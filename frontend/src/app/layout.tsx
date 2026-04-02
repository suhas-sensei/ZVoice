import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZVoice - Privacy-Preserving Invoice Reimbursement",
  description: "ZK-powered corporate invoice verification and reimbursement on StarkNet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
