import { NextRequest, NextResponse } from "next/server";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

// ── POST: parse free text into structured data ────────────────────────────────
export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // ---- MOCK PARSER ----
  // Replace this block with an actual AI call (e.g. Anthropic Claude API).
  const amountMatch = text.match(/[\d,]+(?:\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[0].replace(/,/g, "")) : 0;

  const dateMatch = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i);
  let date = new Date().toISOString().split("T")[0];
  if (dateMatch) {
    const parsed = new Date(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`);
    if (!isNaN(parsed.getTime())) date = parsed.toISOString().split("T")[0];
  }

  const parsed = {
    type: "expense",
    propertyName: "Unknown Property",
    category: "Maintenance",
    description: text.slice(0, 100),
    amount,
    currency: text.includes("USD") ? "USD" : "UGX",
    date,
  };
  // ---- END MOCK ----

  return NextResponse.json(parsed);
}

// ── PUT: approve and save parsed data ────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { approved, payload, ownerId } = body;

  if (!approved || !payload || !ownerId) {
    return NextResponse.json({ error: "approved, payload and ownerId are required" }, { status: 400 });
  }

  if (payload.type === "expense") {
    await addDoc(collection(db, "propertyExpenses"), {
      ownerId,
      propertyId: payload.propertyId ?? "unknown",
      category: payload.category ?? "Other",
      description: payload.description ?? "",
      amount: Number(payload.amount) || 0,
      currency: payload.currency ?? "UGX",
      date: payload.date ?? new Date().toISOString().split("T")[0],
      source: "ai-parsed",
      createdAt: serverTimestamp(),
    });
  }

  return new NextResponse(null, { status: 204 });
}
