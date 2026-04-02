import { NextRequest, NextResponse } from "next/server";
import { approveInvoiceOnChain, markPaidOnChain, getInvoices, getPreferredToken } from "@/lib/contract";
import { payEmployee } from "@/lib/starkzap";

export async function POST(request: NextRequest) {
  const { invoiceId, employeeAddress, amountCents, preferredToken, adminAddress } =
    await request.json();

  // On-chain access control is enforced by the contract itself

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

    // Get employee's preferred token from on-chain registry
    let tokenToUse = preferredToken;
    if (!tokenToUse && invoice?.employee) {
      try {
        const onChainToken = await getPreferredToken(invoice.employee);
        if (onChainToken && BigInt(onChainToken) !== 0n) {
          tokenToUse = onChainToken;
        }
      } catch { /* use default */ }
    }

    // Pay employee via StarkZap (swaps from STRK to preferred token)
    const { txHash: paymentTx } = await payEmployee({
      employeeAddress: employeeAddress || invoice?.employee || "",
      amountCents: amountCents || invoice?.amountCents || 0,
      preferredToken: tokenToUse,
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
