'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_QUESTIONS = [
  "What's my total rental income this month?",
  "Which tenant has the most overdue payments?",
  "How much did I earn from each property this year?",
  "What's my estimated tax liability this fiscal year?",
  "What are my top maintenance expenses?",
];

export default function AIInsightsPage() {
  const { payments, leases, properties, units, maintenance, landlord } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function buildFinancialData() {
    return {
      landlordName: landlord.name,
      payments: payments.map(p => ({
        lease_id: p.lease_id,
        property_id: p.property_id,
        amount: p.amount,
        date: p.date,
        withholding_tax_amount: p.withholding_tax_amount,
      })),
      leases: leases.map(l => ({
        id: l.id,          // kept — used for overdue detection in API route
        property_id: l.property_id,
        rent_amount: l.rent_amount,
        currency: l.currency,
        status: l.status,
        due_day: l.due_day,
      })),
      properties: properties.map(p => ({
        id: p.id,
        name: p.name,
        district: p.district,
      })),
      maintenance: maintenance.map(m => ({
        property_id: m.property_id,
        cost: m.cost,
        category: m.category,
        payer: m.payer,
        date: m.date,
      })),
    };
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          financialData: buildFinancialData(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to get response');
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setError(e.message);
      // Remove the user message if it failed so they can retry
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">AI Financial Insights</h1>
        <p className="text-gray-500 mt-1">Ask questions about your rental portfolio in plain English.</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border shadow-sm p-4 space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">AI</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Your AI Financial Advisor</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm">
              Ask me anything about your rental income, expenses, tenants, or taxes. I have access to all your RentFlow data.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTER_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-4 py-2 hover:bg-blue-100 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                AI
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
              AI
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick questions (shown after first message) */}
      {messages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 flex-shrink-0 scrollbar-hide">
          {STARTER_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:bg-gray-50 whitespace-nowrap flex-shrink-0 disabled:opacity-50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 bg-white rounded-xl border shadow-sm p-3 flex gap-3 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your rental income, expenses, taxes..."
          rows={1}
          className="flex-1 resize-none border-0 outline-none text-sm text-gray-800 placeholder-gray-400 max-h-32"
          style={{ minHeight: '36px' }}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Send"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-2 flex-shrink-0">
        Powered by Claude · Data from your RentFlow account
      </p>
    </div>
  );
}
