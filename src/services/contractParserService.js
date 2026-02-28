/**
 * Contract Parser Service
 *
 * Extracts structured fields from a written rental/tenancy contract document.
 * Fields extracted:
 *   - tenantName      : name of the tenant(s)
 *   - landlordName    : name of the landlord/lessor
 *   - address         : full property address
 *   - startDate       : tenancy start date (ISO string or raw text)
 *   - endDate         : tenancy end date (ISO string or raw text)
 *   - duration        : tenancy duration (e.g. "6 months", "1 year")
 *   - rentAmount      : periodic rent (e.g. "£850 per month")
 *   - depositAmount   : security deposit (e.g. "£1700")
 *   - rentFrequency   : "monthly" | "weekly" | "annually" | null
 *   - itemName        : what is being rented (property/item description)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function first(text, ...patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return (m[1] || m[0]).trim();
  }
  return null;
}

/**
 * Try to parse a date string into ISO format. Returns the raw string on
 * failure so we never silently drop a matched value.
 */
function normaliseDate(raw) {
  if (!raw) return null;
  const cleaned = raw.trim();
  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned;
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? cleaned : d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Individual field extractors
// ---------------------------------------------------------------------------

function extractTenantName(text) {
  return first(
    text,
    // "Tenant: John Smith" / "Tenant Name: John Smith"
    /(?:tenant|lessee)(?:\s+name)?[:\s]+([A-Z][a-zA-Z\s\-'.,]+?)(?:\n|,|hereinafter|referred|of\s+\d)/i,
    // "between ... (Landlord) and John Smith (Tenant)"
    /\band\s+([A-Z][a-zA-Z\s\-'.]+?)\s*(?:\(Tenant\)|\(Lessee\))/i,
    // "This agreement is entered into by John Smith (hereafter "Tenant")"
    /by\s+([A-Z][a-zA-Z\s\-'.]+?)\s*(?:\(hereafter|\(hereinafter|,\s*(?:the\s+)?(?:[""]?Tenant[""]?|Lessee))/i,
    // "Tenants?: John Smith and Jane Smith"
    /Tenants?\s*:\s*([A-Z][^\n,]+)/,
  );
}

function extractLandlordName(text) {
  return first(
    text,
    /(?:landlord|lessor|owner)(?:\s+name)?[:\s]+([A-Z][a-zA-Z\s\-'.,]+?)(?:\n|,|hereinafter|referred|of\s+\d)/i,
    // "between John Smith (Landlord) and ..."
    /between\s+([A-Z][a-zA-Z\s\-'.]+?)\s*(?:\(Landlord\)|\(Lessor\))/i,
    /Landlords?\s*:\s*([A-Z][^\n,]+)/,
  );
}

function extractAddress(text) {
  return first(
    text,
    // "Property Address: 123 High Street, London, SW1A 1AA"
    /(?:property\s+)?address[:\s]+([^\n]+(?:\n[^\n]+){0,2})/i,
    // "located at 123 High Street"
    /(?:located|situated|known)\s+at[:\s]+([^\n]+)/i,
    // "the property at 123 ..."
    /the\s+property\s+at\s+([^\n,]+(?:,[^\n,]+){0,3})/i,
    // "premises at / of: ..."
    /premises\s+(?:at|of)[:\s]+([^\n]+)/i,
    // British postcode anchor: capture everything before postcode on same line
    /(\d+[^\n]*?[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/,
    // US ZIP anchor
    /(\d+[^\n]*?,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/,
  );
}

function extractStartDate(text) {
  const raw = first(
    text,
    /(?:commencement|start|beginning|from)\s+date[:\s]+([^\n,]+)/i,
    /(?:commencing|starting|beginning)\s+(?:on\s+)?([A-Za-z0-9,\s]+\d{4})/i,
    /(?:from|on)\s+(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?[A-Za-z]+\s*,?\s*\d{4})/i,
    /(?:from|on)\s+(?:the\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /tenancy\s+(?:start|commence[sd]*)[:\s]+([^\n,]+)/i,
  );
  return normaliseDate(raw);
}

function extractEndDate(text) {
  const raw = first(
    text,
    /(?:expiry|expiration|end|termination)\s+date[:\s]+([^\n,]+)/i,
    /(?:expiring|ending|terminating|until|through)\s+(?:on\s+)?([A-Za-z0-9,\s]+\d{4})/i,
    /(?:to|until|through)\s+(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?[A-Za-z]+\s*,?\s*\d{4})/i,
    /(?:to|until)\s+(?:the\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /tenancy\s+end[:\s]+([^\n,]+)/i,
  );
  return normaliseDate(raw);
}

function extractDuration(text) {
  return first(
    text,
    // "for a period of 6 months" / "for 1 year" / "for twelve months"
    /for\s+(?:a\s+)?(?:period\s+of\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:calendar\s+)?(?:months?|years?|weeks?)/i,
    /(?:duration|term|period)[:\s]+([^\n,]+(?:months?|years?|weeks?))/i,
    /(\d+[\-\s]?(?:months?|years?|weeks?))\s+(?:tenancy|lease|term)/i,
  );
}

function extractRentAmount(text) {
  return first(
    text,
    // "rent: £850 per month" / "monthly rent: $1,200"
    /(?:monthly\s+)?rent(?:\s+amount)?[:\s]+([£$€\d][^\n,]+)/i,
    // "a rent of £850 per calendar month"
    /(?:a\s+)?rent\s+of\s+([£$€][\d,]+(?:\.\d{2})?(?:\s+per\s+[^\n,]+)?)/i,
    // "£850 per month" / "$1,200/month"
    /([£$€][\d,]+(?:\.\d{2})?\s*(?:per\s+(?:calendar\s+)?month|p\.?c\.?m\.?|\/month|per\s+week|\/week))/i,
    // "850 GBP per month"
    /([\d,]+(?:\.\d{2})?\s*(?:GBP|USD|EUR)\s*(?:per\s+(?:calendar\s+)?month|per\s+week))/i,
  );
}

function extractDepositAmount(text) {
  return first(
    text,
    /(?:security\s+)?deposit(?:\s+amount)?[:\s]+([£$€\d][^\n,]+)/i,
    /(?:a\s+)?deposit\s+of\s+([£$€][\d,]+(?:\.\d{2})?)/i,
    /([£$€][\d,]+(?:\.\d{2})?)\s+(?:security\s+)?deposit/i,
  );
}

function extractRentFrequency(text) {
  if (/per\s+(?:calendar\s+)?month|monthly|p\.?c\.?m/i.test(text)) return 'monthly';
  if (/per\s+week|weekly/i.test(text)) return 'weekly';
  if (/per\s+(?:annum|year)|annually|yearly/i.test(text)) return 'annually';
  return null;
}

function extractItemName(text) {
  return first(
    text,
    // "rental of / lease of [item]"
    /(?:rental|lease|hire|letting)\s+of\s+(?:the\s+)?([^\n,]+)/i,
    // "the property known as / described as"
    /the\s+property\s+(?:known|described)\s+as\s+[""']?([^"'\n,]+)/i,
    // "residential property / commercial unit / flat / house / vehicle"
    /((?:residential|commercial|industrial)\s+(?:property|premises|unit|space))/i,
    /((?:flat|apartment|house|studio|maisonette|bungalow|cottage|villa|room|vehicle|car|van|bicycle|equipment|machinery)\b[^\n,]*)/i,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a contract document and return all extracted fields.
 *
 * @param {string} document - Full text of the contract
 * @returns {object} Extracted fields (null for any field that could not be found)
 */
function parseContract(document) {
  if (!document || typeof document !== 'string' || !document.trim()) {
    throw new Error('Document text is required');
  }

  const text = document.trim();

  const fields = {
    tenantName:    extractTenantName(text),
    landlordName:  extractLandlordName(text),
    address:       extractAddress(text),
    startDate:     extractStartDate(text),
    endDate:       extractEndDate(text),
    duration:      extractDuration(text),
    rentAmount:    extractRentAmount(text),
    depositAmount: extractDepositAmount(text),
    rentFrequency: extractRentFrequency(text),
    itemName:      extractItemName(text),
  };

  // Summarise what was and wasn't found
  const found    = Object.keys(fields).filter((k) => fields[k] !== null);
  const missing  = Object.keys(fields).filter((k) => fields[k] === null);

  return { fields, found, missing };
}

module.exports = { parseContract };
