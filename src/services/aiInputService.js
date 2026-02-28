/**
 * AI Input Service — parses natural language rental requests
 * into structured rental data.
 *
 * Freely accessible to all authenticated users (no paywall).
 *
 * Examples:
 *   "I want to rent a bicycle"         → { itemName: "bicycle" }
 *   "rent me a power drill"            → { itemName: "power drill" }
 *   "I need a tent and a sleeping bag" → [{ itemName: "tent" }, { itemName: "sleeping bag" }]
 *   "Can I get a kayak please?"        → { itemName: "kayak" }
 */

const RENT_PATTERNS = [
  // "I want to rent a ___"
  /(?:i\s+)?(?:want|would like|wanna|'d like)\s+to\s+rent\s+(?:a|an|the|some)?\s*(.+)/i,
  // "rent me a ___" / "rent a ___"
  /rent\s+(?:me\s+)?(?:a|an|the|some)?\s*(.+)/i,
  // "I need a ___"
  /(?:i\s+)?need\s+(?:a|an|the|some)?\s*(.+)/i,
  // "Can I get a ___"
  /can\s+i\s+(?:get|have|borrow|use)\s+(?:a|an|the|some)?\s*(.+)/i,
  // "I'd like a ___"
  /(?:i\s+)?(?:'d|would)\s+like\s+(?:a|an|the|some)?\s*(.+)/i,
  // "looking for a ___"
  /looking\s+for\s+(?:a|an|the|some)?\s*(.+)/i,
  // "borrow a ___"
  /(?:(?:can|could|may)\s+i\s+)?borrow\s+(?:a|an|the|some)?\s*(.+)/i,
  // "book a ___"
  /book\s+(?:a|an|the|some)?\s*(.+)/i,
  // "reserve a ___"
  /reserve\s+(?:a|an|the|some)?\s*(.+)/i,
  // "get me a ___"
  /get\s+me\s+(?:a|an|the|some)?\s*(.+)/i,
];

// Words/phrases to strip from the end of a matched item
const TRAILING_NOISE = [
  /\s*[,.]?\s*(?:please|pls|plz|thanks|thank you|thx|asap)\.?\s*$/i,
  /\s*(?:for\s+(?:the\s+)?(?:day|week|weekend|month|hour|a\s+while|now|today|tomorrow))\.?\s*$/i,
  /\s*(?:right\s+now|if\s+(?:possible|you\s+can))\.?\s*$/i,
];

/**
 * Split on "and", "&", commas to extract multiple items.
 */
function splitItems(raw) {
  return raw
    .split(/\s*(?:,\s*(?:and\s+)?|\s+and\s+|\s*&\s*)\s*/i)
    .map((s) => s.replace(/^(?:a|an|the|some)\s+/i, '').trim())
    .filter(Boolean);
}

/**
 * Clean trailing filler words from an item name.
 */
function cleanItem(item) {
  let cleaned = item.trim();
  for (const pattern of TRAILING_NOISE) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

/**
 * Parse a free-form text string and extract item name(s).
 *
 * @param {string} text - Natural language rental request
 * @returns {{ items: string[] }} - Extracted item names
 * @throws {Error} if text is empty or no items could be extracted
 */
function parseRentalInput(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Text input is required');
  }

  const input = text.trim();

  for (const pattern of RENT_PATTERNS) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const raw = match[1].trim();
      const items = splitItems(raw).map(cleanItem).filter(Boolean);
      if (items.length > 0) {
        return { items };
      }
    }
  }

  // Fallback: if no pattern matched, treat the entire input as an item name
  // (allows simple inputs like "bicycle" or "power drill")
  const fallbackItems = splitItems(input).map(cleanItem).filter(Boolean);
  if (fallbackItems.length > 0) {
    return { items: fallbackItems };
  }

  throw new Error('Could not understand the rental request. Try something like "I want to rent a bicycle".');
}

module.exports = { parseRentalInput };
