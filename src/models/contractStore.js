/**
 * In-memory contract store.
 *
 * Each contract record tracks:
 *   - id             : unique contract identifier
 *   - userId         : the user who created the contract
 *   - contract       : the generated contract text
 *   - fields         : the structured fields used/extracted
 *   - source         : "fields" | "text" | "parsed-document"
 *   - originalText   : the input text (if generated from text or parsed)
 *   - createdAt      : timestamp
 */

const contracts = new Map();
let counter = 0;

function generateId() {
  counter += 1;
  return `contract_${Date.now()}_${counter}`;
}

function create({ userId, contract, fields, source, originalText }) {
  const id = generateId();
  const record = {
    id,
    userId,
    contract,
    fields,
    source,
    originalText: originalText || null,
    createdAt: new Date().toISOString(),
  };
  contracts.set(id, record);
  return { ...record };
}

function findById(id) {
  const record = contracts.get(id);
  return record ? { ...record } : null;
}

function findAllByUser(userId) {
  const results = [];
  for (const record of contracts.values()) {
    if (record.userId === userId) {
      // Return a summary (omit full contract text from list view)
      results.push({
        id: record.id,
        source: record.source,
        fields: record.fields,
        createdAt: record.createdAt,
      });
    }
  }
  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { create, findById, findAllByUser };
