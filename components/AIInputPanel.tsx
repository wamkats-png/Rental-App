"use client";

import { useState } from "react";

interface ParsedResult {
  type: string;
  propertyName?: string;
  category?: string;
  description?: string;
  amount?: number;
  date?: string;
  currency?: string;
  [key: string]: unknown;
}

interface AIInputPanelProps {
  ownerId: string;
}

export default function AIInputPanel({ ownerId }: AIInputPanelProps) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleParse() {
    setStatus("parsing");
    setResult(null);
    try {
      const res = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data: ParsedResult = await res.json();
      setResult(data);
      setStatus("idle");
    } catch {
      setErrorMsg("Failed to parse. Try again.");
      setStatus("error");
    }
  }

  async function handleApprove() {
    if (!result) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/ai/parse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true, payload: result, ownerId }),
      });
      if (res.status === 204) {
        setStatus("saved");
        setText(""); setResult(null);
      } else {
        throw new Error("Save failed");
      }
    } catch {
      setErrorMsg("Failed to save. Try again.");
      setStatus("error");
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow space-y-3 max-w-lg">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Paste free text (e.g. 'Paid UGX 250,000 for plumbing repairs at Kiwatule House on 15 Jan 2025')"
        className="input w-full"
      />
      <button onClick={handleParse} disabled={status === "parsing" || !text.trim()}
        className="btn-primary">
        {status === "parsing" ? "Parsing…" : "Parse with AI"}
      </button>
      {result && (
        <div className="space-y-2">
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
          <button onClick={handleApprove} disabled={status === "saving"}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium">
            {status === "saving" ? "Saving…" : "Approve & Save"}
          </button>
        </div>
      )}
      {status === "saved" && (
        <p className="text-green-600 text-sm font-medium">Saved successfully!</p>
      )}
      {status === "error" && (
        <p className="text-red-500 text-sm">{errorMsg}</p>
      )}
    </div>
  );
}
