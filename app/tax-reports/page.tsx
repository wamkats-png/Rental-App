'use client';

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUGX, formatDate, getCurrentTaxYear } from '../lib/utils';
import { exportToCSV } from '../lib/csvExport';
import { downloadReceiptPDF } from '../lib/pdfReceipt';

export default function TaxReportsPage() {
  const { landlord, properties, units, payments, maintenance, expenses } = useApp();
  const currentTY = getCurrentTaxYear();

  const [selectedYear, setSelectedYear] = useState(currentTY.label);
  const [downloading, setDownloading] = useState(false);

  const parseYear = (label: string) => {
    const startYear = parseInt(label.split('/')[0]);
    return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30`, label };
  };

  const years = Array.from({ length: 5 }, (_, i) => {
    const now = new Date();
    const baseYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const y = baseYear - i;
    return `${y}/${y + 1}`;
  });

  const taxYear = parseYear(selectedYear);

  const periodPayments = payments.filter(p => p.date >= taxYear.start && p.date <= taxYear.end);
  const periodMaintenance = maintenance.filter(m => m.date >= taxYear.start && m.date <= taxYear.end);
  const periodExpenses = expenses.filter(e => e.date >= taxYear.start && e.date <= taxYear.end);

  const grossIncome = periodPayments.reduce((s, p) => s + p.amount, 0);
  const totalWHT = periodPayments.reduce((s, p) => s + p.withholding_tax_amount, 0);
  const maintenanceExpenses = periodMaintenance.filter(m => m.payer === 'Landlord').reduce((s, m) => s + m.cost, 0);
  const otherExpenses = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const landlordExpenses = maintenanceExpenses + otherExpenses;

  const isIndividual = landlord.landlord_type === 'Individual';
  // Uganda Income Tax Act threshold — last updated FY 2024/2025 (Finance Act 2024)
  // Check URA website for updates: ura.go.ug
  const INDIVIDUAL_THRESHOLD = 2_820_000;
  const roundUGX = (n: number) => Math.round(n / 100) * 100; // round to nearest UGX 100

  let netTaxableIncome: number;
  let taxLiability: number;

  if (isIndividual) {
    netTaxableIncome = grossIncome;
    taxLiability = grossIncome > INDIVIDUAL_THRESHOLD ? roundUGX((grossIncome - INDIVIDUAL_THRESHOLD) * 0.12) : 0;
  } else {
    netTaxableIncome = Math.max(grossIncome - landlordExpenses, 0);
    taxLiability = roundUGX(netTaxableIncome * 0.30);
  }

  const balanceDue = taxLiability - totalWHT;

  // Monthly breakdown — fiscal year runs Jul–Jun, use Date arithmetic to avoid month-13 bugs
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const startYear = parseInt(selectedYear.split('/')[0]);
    // Month 0 of fiscal year = July (month index 6); use Date to handle year rollover correctly
    const monthDate = new Date(startYear, 6 + i, 1);
    const nextMonthDate = new Date(startYear, 6 + i + 1, 1);
    const monthStart = monthDate.toISOString().split('T')[0];
    const nextMonth = nextMonthDate.toISOString().split('T')[0];
    const monthPayments = periodPayments.filter(p => p.date >= monthStart && p.date < nextMonth);
    const total = monthPayments.reduce((s, p) => s + p.amount, 0);
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return { month: monthName, total, count: monthPayments.length };
  });

  // Property breakdown
  const propertyBreakdown = properties.map(p => {
    const propPayments = periodPayments.filter(pay => pay.property_id === p.id);
    const income = propPayments.reduce((s, pay) => s + pay.amount, 0);
    const propUnits = units.filter(u => u.property_id === p.id);
    return { name: p.name, income, units: propUnits.length, payments: propPayments.length };
  }).filter(p => p.income > 0).sort((a, b) => b.income - a.income);

  const handleExport = () => {
    const data = [{
      Tax_Year: selectedYear,
      Landlord_Type: landlord.landlord_type,
      Gross_Income: grossIncome,
      Maintenance_Expenses: isIndividual ? 'N/A' : maintenanceExpenses,
      Other_Expenses: isIndividual ? 'N/A' : otherExpenses,
      Total_Allowable_Expenses: isIndividual ? 'N/A' : landlordExpenses,
      Net_Taxable_Income: netTaxableIncome,
      Tax_Rate: isIndividual ? '12%' : '30%',
      Tax_Liability: taxLiability,
      WHT_Paid: totalWHT,
      Balance_Due: balanceDue,
    }];
    exportToCSV(data, `tax-report-${selectedYear.replace('/', '-')}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tax Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Uganda rental income tax reporting (July - June fiscal year)</p>
        </div>
        <div className="flex gap-2">
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
            {years.map(y => <option key={y} value={y}>FY {y}</option>)}
          </select>
          <button
            onClick={async () => {
              setDownloading(true);
              await downloadReceiptPDF('tax-report-content', `tax-report-${selectedYear.replace('/', '-')}.pdf`, 'a4');
              setDownloading(false);
            }}
            disabled={downloading}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50"
          >
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button onClick={handleExport} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm">Export CSV</button>
        </div>
      </div>

      <div id="tax-report-content">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700 font-medium">Tax Year {selectedYear}</p>
            <p className="text-xs text-blue-600">July {selectedYear.split('/')[0]} - June {selectedYear.split('/')[1]}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-700">Account Type: <span className="font-semibold">{landlord.landlord_type}</span></p>
            <p className="text-xs text-blue-600">Tax Rate: {isIndividual ? '12% (above UGX 2,820,000)' : '30% on net income'}</p>
          </div>
        </div>
      </div>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500 mb-1">Gross Rental Income</p>
          <p className="text-2xl font-bold text-gray-800">{formatUGX(grossIncome)}</p>
          <div className="h-1 bg-green-500 rounded mt-3" />
        </div>
        {!isIndividual && (
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-sm text-gray-500 mb-1">Allowable Expenses</p>
            <p className="text-2xl font-bold text-orange-600">{formatUGX(landlordExpenses)}</p>
            <div className="h-1 bg-orange-500 rounded mt-3" />
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500 mb-1">Net Taxable Income</p>
          <p className="text-2xl font-bold text-gray-800">{formatUGX(isIndividual ? Math.max(grossIncome - INDIVIDUAL_THRESHOLD, 0) : netTaxableIncome)}</p>
          <div className="h-1 bg-blue-500 rounded mt-3" />
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500 mb-1">Tax Liability</p>
          <p className="text-2xl font-bold text-red-600">{formatUGX(taxLiability)}</p>
          <div className="h-1 bg-red-500 rounded mt-3" />
        </div>
      </div>

      {/* Tax Calculation Detail */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Tax Calculation</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Gross Rental Income</span><span className="font-medium">{formatUGX(grossIncome)}</span></div>
          {isIndividual ? (
            <>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Tax-Free Threshold</span><span className="font-medium text-green-600">- {formatUGX(INDIVIDUAL_THRESHOLD)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Taxable Amount</span><span className="font-medium">{formatUGX(Math.max(grossIncome - INDIVIDUAL_THRESHOLD, 0))}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Tax @ 12%</span><span className="font-bold text-red-600">{formatUGX(taxLiability)}</span></div>
            </>
          ) : (
            <>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Less: Maintenance Expenses (Landlord)</span><span className="font-medium text-orange-600">- {formatUGX(maintenanceExpenses)}</span></div>
              {otherExpenses > 0 && (
                <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Less: Other Expenses (Expenses module)</span><span className="font-medium text-orange-600">- {formatUGX(otherExpenses)}</span></div>
              )}
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Total Allowable Expenses</span><span className="font-medium text-orange-600">- {formatUGX(landlordExpenses)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Net Taxable Income</span><span className="font-medium">{formatUGX(netTaxableIncome)}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Tax @ 30%</span><span className="font-bold text-red-600">{formatUGX(taxLiability)}</span></div>
            </>
          )}
          <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Less: Withholding Tax Paid</span><span className="font-medium text-green-600">- {formatUGX(totalWHT)}</span></div>
          <div className="flex justify-between py-3 bg-gray-50 rounded px-3">
            <span className="font-semibold text-gray-800">{balanceDue >= 0 ? 'Balance Due to URA' : 'Refund Due'}</span>
            <span className={`font-bold text-lg ${balanceDue >= 0 ? 'text-red-600' : 'text-green-600'}`}>{formatUGX(Math.abs(balanceDue))}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Monthly Income Breakdown</h2>
          <div className="space-y-2">
            {monthlyData.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{m.month}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{m.count} payment(s)</span>
                  <span className="text-sm font-medium w-32 text-right">{formatUGX(m.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Property Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Income by Property</h2>
          {propertyBreakdown.length === 0 ? (
            <p className="text-gray-500 text-sm">No income recorded for this period.</p>
          ) : (
            <div className="space-y-3">
              {propertyBreakdown.map((p, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="font-bold text-green-700">{formatUGX(p.income)}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{p.units} unit(s)</span>
                    <span>{p.payments} payment(s)</span>
                    <span>{grossIncome > 0 ? Math.round((p.income / grossIncome) * 100) : 0}% of total</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>{/* /tax-report-content */}
    </div>
  );
}
