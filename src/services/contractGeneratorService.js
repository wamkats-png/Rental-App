/**
 * Contract Generator Service
 *
 * Generates a formatted tenancy/rental contract from either:
 *   (a) structured fields provided directly, or
 *   (b) free text describing the terms — parsed first, then rendered.
 *
 * Fields accepted:
 *   tenantName      {string}  - Name of the tenant
 *   landlordName    {string}  - Name of the landlord
 *   address         {string}  - Property / item address or description
 *   startDate       {string}  - Tenancy start (ISO or human-readable)
 *   endDate         {string}  - Tenancy end   (ISO or human-readable)
 *   duration        {string}  - e.g. "6 months", "1 year"  (computed if omitted)
 *   rentAmount      {string}  - e.g. "£850", "850", "$1200"
 *   rentFrequency   {string}  - "monthly" | "weekly" | "annually" (default: "monthly")
 *   depositAmount   {string}  - e.g. "£1700" (defaults to 2× rent if omitted)
 *   itemName        {string}  - Short description of what is rented
 *   additionalTerms {string}  - Any extra clauses in plain text
 */

const { parseContract } = require('./contractParserService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORD_TO_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
};

/**
 * Extract a plain number from strings like "£850", "850", "$1,200.00".
 */
function toNumber(str) {
  if (!str) return null;
  const m = String(str).replace(/,/g, '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Format a date string for display in a contract (e.g. "1 January 2025").
 */
function formatDate(raw) {
  if (!raw) return '________________';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Extract structured fields from free text describing rental terms.
 * Reuses the contract parser on informal descriptions.
 *
 * E.g.: "John rents flat 3B, 12 Baker Street to Sarah for 6 months
 *        starting 1 March 2025 at £900 per month"
 */
function parseFromFreeText(text) {
  // Run the full contract parser — it handles both formal and informal text
  const { fields } = parseContract(text);

  // Supplement with simpler inline patterns for free-text descriptions

  // Tenant: "to Sarah" / "for Sarah Jones"
  if (!fields.tenantName) {
    const m = text.match(/(?:to|for)\s+([A-Z][a-zA-Z\s\-'.]+?)(?:\s+for|\s+at|\s+starting|\s+from|,|\.|$)/);
    if (m) fields.tenantName = m[1].trim();
  }

  // Landlord: first proper name before "rents"/"lets"/"leases"
  if (!fields.landlordName) {
    const m = text.match(/^([A-Z][a-zA-Z\s\-'.]+?)\s+(?:rents?|lets?|leases?|is\s+renting)/m);
    if (m) fields.landlordName = m[1].trim();
  }

  // Duration from inline pattern: "for 6 months" / "for a year"
  if (!fields.duration) {
    const m = text.match(/for\s+(?:a\s+)?(\w+)\s+(months?|years?|weeks?)/i);
    if (m) {
      const n = WORD_TO_NUM[m[1].toLowerCase()] || parseInt(m[1], 10);
      if (!isNaN(n)) fields.duration = `${n} ${m[2].toLowerCase()}`;
    }
  }

  // Rent: "at £900 per month" / "£900/month" / "$1200 monthly"
  if (!fields.rentAmount) {
    const m = text.match(/(?:at\s+)?([£$€][\d,]+(?:\.\d{2})?)\s*(?:per\s+(?:calendar\s+)?month|\/month|monthly|per\s+week|weekly)/i);
    if (m) fields.rentAmount = m[1];
  }

  // Start date: "starting 1 March 2025" / "from March 2025"
  if (!fields.startDate) {
    const m = text.match(/(?:starting|from|beginning|on)\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Za-z]+\s+\d{4})/i);
    if (m) {
      const d = new Date(m[1]);
      fields.startDate = isNaN(d.getTime()) ? m[1] : d.toISOString().split('T')[0];
    }
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Contract template renderer
// ---------------------------------------------------------------------------

/**
 * Render a standard tenancy/rental agreement from a fields object.
 */
function renderContract(f) {
  const landlord     = f.landlordName    || '[LANDLORD NAME]';
  const tenant       = f.tenantName      || '[TENANT NAME]';
  const address      = f.address         || '[PROPERTY ADDRESS]';
  const item         = f.itemName        || 'the rental property';
  const startDisplay = formatDate(f.startDate);
  const endDisplay   = formatDate(f.endDate);
  const duration     = f.duration        || (f.endDate ? '' : '[DURATION]');
  const frequency    = f.rentFrequency   || 'monthly';
  const rentRaw      = toNumber(f.rentAmount);
  const rentDisplay  = rentRaw
    ? `£${rentRaw.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
    : (f.rentAmount || '[RENT AMOUNT]');
  const depositRaw   = toNumber(f.depositAmount) || (rentRaw ? rentRaw * 2 : null);
  const depositDisplay = depositRaw
    ? `£${depositRaw.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
    : '[DEPOSIT AMOUNT]';

  const durationClause = duration
    ? `for a fixed term of ${duration}, commencing on ${startDisplay}`
    : `commencing on ${startDisplay}`;

  const endClause = f.endDate
    ? ` and expiring on ${endDisplay}`
    : '';

  const additionalTerms = f.additionalTerms
    ? `\n\n9. ADDITIONAL TERMS\n\n${f.additionalTerms.trim()}`
    : '';

  return `TENANCY AGREEMENT
=================

This Tenancy Agreement ("Agreement") is entered into on ${formatDate(new Date().toISOString())}

BETWEEN

Landlord: ${landlord}
          ("the Landlord")

AND

Tenant:   ${tenant}
          ("the Tenant")

─────────────────────────────────────────────────────────────────────────────

1. PROPERTY

The Landlord agrees to let and the Tenant agrees to take ${item} situated at:

  ${address}

("the Property")

─────────────────────────────────────────────────────────────────────────────

2. TERM

The tenancy shall be ${durationClause}${endClause}.

─────────────────────────────────────────────────────────────────────────────

3. RENT

3.1  The Tenant shall pay a ${frequency} rent of ${rentDisplay} (${frequency.toUpperCase()} RENT).

3.2  Rent is payable in advance on the same day of each period, beginning
     ${startDisplay}.

3.3  Rent shall be paid by bank transfer or such other method as agreed in
     writing by both parties.

─────────────────────────────────────────────────────────────────────────────

4. DEPOSIT

4.1  The Tenant shall pay a security deposit of ${depositDisplay} ("the Deposit")
     before the commencement of the tenancy.

4.2  The Deposit shall be held to cover any damage, unpaid rent, or breach of
     this Agreement by the Tenant.

4.3  The Deposit shall be returned to the Tenant within 10 working days of the
     end of the tenancy, less any lawful deductions.

─────────────────────────────────────────────────────────────────────────────

5. TENANT OBLIGATIONS

The Tenant agrees to:

5.1  Pay the rent on time.
5.2  Keep the Property clean and in good repair.
5.3  Not sublet the Property without the Landlord's written consent.
5.4  Not make alterations without the Landlord's written consent.
5.5  Allow the Landlord reasonable access for inspection with 24 hours' notice.
5.6  Report any repairs or defects to the Landlord promptly.

─────────────────────────────────────────────────────────────────────────────

6. LANDLORD OBLIGATIONS

The Landlord agrees to:

6.1  Provide the Property in a good and habitable condition.
6.2  Carry out structural repairs and maintenance.
6.3  Respect the Tenant's right to quiet enjoyment of the Property.
6.4  Provide adequate notice before entering the Property.

─────────────────────────────────────────────────────────────────────────────

7. TERMINATION

7.1  Either party may terminate this Agreement by giving one month's written
     notice (or such notice period as required by law, whichever is greater).

7.2  The Landlord may terminate immediately in the event of material breach by
     the Tenant, including non-payment of rent.

─────────────────────────────────────────────────────────────────────────────

8. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws
of England and Wales (or the applicable jurisdiction).
${additionalTerms}

─────────────────────────────────────────────────────────────────────────────

SIGNATURES

Landlord: _________________________________  Date: ________________
           ${landlord}

Tenant:   _________________________________  Date: ________________
           ${tenant}

─────────────────────────────────────────────────────────────────────────────
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a contract from structured fields.
 *
 * @param {object} fields
 * @returns {{ contract: string, fields: object }}
 */
function generateFromFields(fields) {
  if (!fields || typeof fields !== 'object') {
    throw new Error('fields object is required');
  }
  const contract = renderContract(fields);
  return { contract, fields };
}

/**
 * Generate a contract from a free-text description.
 *
 * @param {string} text  - Natural language description of the rental terms
 * @returns {{ contract: string, fields: object, missing: string[] }}
 */
function generateFromText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Text description is required');
  }

  const fields = parseFromFreeText(text);

  const allFields = [
    'tenantName', 'landlordName', 'address', 'startDate',
    'rentAmount', 'duration',
  ];
  const missing = allFields.filter((k) => !fields[k]);

  const contract = renderContract(fields);
  return { contract, fields, missing };
}

module.exports = { generateFromFields, generateFromText };
