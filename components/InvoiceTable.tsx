"use client";

import { markInvoicePaid } from "@/lib/firestoreCollections";
import type { Invoice } from "@/types/invoice";

interface InvoiceTableProps {
  invoices: Invoice[];
  onUpdated: () => void;
}

const statusColor: Record<string, string> = {
  pending: "text-yellow-600 bg-yellow-50",
  paid: "text-green-600 bg-green-50",
  overdue: "text-red-600 bg-red-50",
};

export default function InvoiceTable({ invoices, onUpdated }: InvoiceTableProps) {
  async function handleMarkPaid(invoice: Invoice) {
    if (!invoice.id) return;
    await markInvoicePaid(invoice.id, new Date().toISOString().split("T")[0]);
    onUpdated();
  }

  if (invoices.length === 0) {
    return <p className="text-gray-400 text-sm mt-4">No invoices yet. Generate them above.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-gray-600 text-left">
            <th className="px-3 py-2">Due Date</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{inv.dueDate}</td>
              <td className="px-3 py-2">{inv.currency} {inv.amount.toLocaleString()}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[inv.status]}`}>
                  {inv.status}
                </span>
              </td>
              <td className="px-3 py-2">
                {inv.status !== "paid" && (
                  <button onClick={() => handleMarkPaid(inv)}
                    className="text-teal-700 hover:underline text-xs">
                    Mark paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
