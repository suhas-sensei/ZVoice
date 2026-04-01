import { NextRequest, NextResponse } from "next/server";
import { approveInvoiceOnChain, markPaidOnChain, getInvoices } from "@/lib/contract";
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
    // Check current invoice status
    const invoices = await getInvoices();
    const invoice = invoices.find((i) => i.id === invoiceId);
    let approveTx = "";

    // Only approve if pending (skip if already auto-approved)
    if (invoice && invoice.status === "pending") {
      approveTx = await approveInvoiceOnChain(invoiceId);
    }

    // Pay employee via StarkZap
    const { txHash: paymentTx } = await payEmployee({
      employeeAddress,
      amountCents,
      preferredToken,
    });

    // Mark paid on-chain
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
