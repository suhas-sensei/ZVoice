import { NextRequest, NextResponse } from "next/server";
import { scanForInvoices } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: "Gmail not connected. Please authorize first." },
      { status: 401 }
    );
  }

  try {
    const emails = await scanForInvoices(refreshToken);

    // Return metadata only — never expose raw email content to the client
    const sanitized = emails.map((e) => ({
      messageId: e.messageId,
      from: e.from,
      subject: e.subject,
      date: e.date,
      vendor: e.vendor,
      amountCents: e.amountCents,
    }));

    return NextResponse.json({ emails: sanitized });
  } catch (error) {
    console.error("Email scan error:", error);
    return NextResponse.json(
      { error: "Failed to scan emails" },
      { status: 500 }
    );
  }
}
