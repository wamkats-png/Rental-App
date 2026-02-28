import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import type { Invoice } from "@/types/invoice";

export async function GET(req: NextRequest) {
  const ownerId = req.nextUrl.searchParams.get("ownerId");
  if (!ownerId) {
    return NextResponse.json({ error: "ownerId required" }, { status: 400 });
  }

  const q = query(collection(db, "invoices"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  const invoices: Invoice[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));

  const header = "invoiceId,tenantId,propertyId,amount,currency,status,dueDate\n";
  const rows = invoices
    .map((inv) =>
      [inv.id, inv.tenantId, inv.propertyId, inv.amount, inv.currency, inv.status, inv.dueDate].join(",")
    )
    .join("\n");

  const csv = header + rows;
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="rentflow-invoices-${date}.csv"`,
    },
  });
}
