/**
 * Importación y exportación de transacciones en formato CSV (RFC 4180).
 */
import { toCents, validateTransaction } from './finance.js';

const HEADER = ['fecha', 'descripcion', 'categoria', 'tipo', 'importe'];
const TYPE_TO_CSV = { income: 'ingreso', expense: 'gasto' };
const CSV_TO_TYPE = { ingreso: 'income', gasto: 'expense', income: 'income', expense: 'expense' };

function escapeField(value) {
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCSV(transactions) {
  const rows = transactions.map((tx) => [
    tx.date,
    tx.description,
    tx.category,
    TYPE_TO_CSV[tx.type],
    (tx.amount / 100).toFixed(2),
  ]);
  return [HEADER, ...rows].map((row) => row.map(escapeField).join(',')).join('\n');
}

/** Divide un texto CSV en filas de campos, respetando comillas y saltos de línea dentro de ellas. */
export function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/**
 * Convierte texto CSV en transacciones. Devuelve las válidas y los errores por línea,
 * para que la interfaz pueda informar al usuario sin abortar toda la importación.
 */
export function fromCSV(text, makeId = () => crypto.randomUUID()) {
  const rows = parseCSVRows(text);
  const transactions = [];
  const errors = [];
  const start = rows[0]?.[0]?.trim().toLowerCase() === 'fecha' ? 1 : 0;
  for (let i = start; i < rows.length; i++) {
    const [date = '', description = '', category = '', type = '', amount = ''] = rows[i].map((f) => f.trim());
    const tx = {
      id: makeId(),
      date,
      description,
      category,
      type: CSV_TO_TYPE[type.toLowerCase()],
      amount: toCents(amount),
      createdAt: Date.now() + i,
    };
    const problems = validateTransaction(tx);
    if (problems.length) errors.push(`Línea ${i + 1}: ${problems.join(' ')}`);
    else transactions.push(tx);
  }
  return { transactions, errors };
}
