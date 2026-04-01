import { NextRequest, NextResponse } from "next/server";
import { approveInvoiceOnChain, markPaidOnChain } from "@/lib/contract";
import { payEmployee } from "@/lib/starkzap";

export async function POST(request: NextRequest) {
  const { invoiceId, employeeAddress, amountCents, preferredToken, adminAddress } =
    await request.json();

  // Verify admin (skip check on devnet for local testing)
  const isDevnet = process.env.STARKNET_NETWORK === "devnet";
  if (!isDevnet) {
    const adminAddresses = (process.env.ADMIN_ADDRESSES || "")
      .split(",")
      .map((a) => a.trim().toLowerCase());

    if (!adminAddress || !adminAddresses.includes(adminAddress.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  if (!invoiceId && invoiceId !== 0) {
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Approve on-chain
    const approveTx = await approveInvoiceOnChain(invoiceId);

    // 2. Pay employee via StarkZap
    const { txHash: paymentTx } = await payEmployee({
      employeeAddress,
      amountCents,
      preferredToken,
    });

    // 3. Mark paid on-chain
    await markPaidOnChain(invoiceId, paymentTx);

    return NextResponse.json({
      success: true,
      approveTx,
      paymentTx,
    });
  } catch (error) {
    console.error("Approve/pay error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Approval/payment failed",
      },
      { status: 500 }
    );
  }
}
