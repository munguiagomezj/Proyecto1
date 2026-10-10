/**
 * Lógica de negocio pura (sin DOM) para el gestor de finanzas.
 * Todas las cantidades se manejan en céntimos (enteros) para evitar
 * errores de redondeo de coma flotante.
 */

export const CATEGORIES = {
  income: ['Salario', 'Freelance', 'Inversiones', 'Regalos', 'Otros ingresos'],
  expense: ['Vivienda', 'Comida', 'Transporte', 'Ocio', 'Salud', 'Educación', 'Suscripciones', 'Otros gastos'],
};

/** Convierte un texto/número en euros a céntimos enteros. Devuelve NaN si no es válido. */
export function toCents(value) {
  if (typeof value === 'number') return Math.round(value * 100);
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

/** Formatea céntimos como moneda local. */
export function formatMoney(cents, locale = 'es-ES', currency = 'EUR') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, useGrouping: 'always' }).format(cents / 100);
}

/** Comprueba que el texto sea una fecha real con formato YYYY-MM-DD (rechaza p. ej. 2026-02-30). */
export function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Normaliza texto para búsquedas: minúsculas y sin tildes. */
function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Valida una transacción y devuelve una lista de errores (vacía si es válida). */
export function validateTransaction(tx) {
  const errors = [];
  if (!tx.description || !tx.description.trim()) errors.push('La descripción es obligatoria.');
  if (!Number.isInteger(tx.amount) || tx.amount <= 0) errors.push('El importe debe ser mayor que 0.');
  if (tx.type !== 'income' && tx.type !== 'expense') errors.push('El tipo debe ser ingreso o gasto.');
  if (!isValidISODate(tx.date)) errors.push('La fecha no es válida.');
  if (!tx.category) errors.push('La categoría es obligatoria.');
  return errors;
}

/** Totales de ingresos, gastos y balance. */
export function summarize(transactions) {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Suma de importes agrupados por categoría para un tipo dado, ordenados de mayor a menor. */
export function totalsByCategory(transactions, type = 'expense') {
  const map = new Map();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Serie mensual de ingresos y gastos para los últimos `months` meses,
 * terminando en el mes de `referenceDate` (incluido). Los meses sin datos aparecen con 0.
 */
export function monthlySeries(transactions, months = 6, referenceDate = new Date()) {
  const series = [];
  const index = new Map();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = { month: key, income: 0, expense: 0 };
    index.set(key, entry);
    series.push(entry);
  }
  for (const tx of transactions) {
    const entry = index.get(tx.date.slice(0, 7));
    if (entry) entry[tx.type] += tx.amount;
  }
  return series;
}

/** Filtra transacciones por texto (sin distinguir mayúsculas ni tildes), tipo, categoría y mes (YYYY-MM). Los filtros vacíos se ignoran. */
export function filterTransactions(transactions, { query = '', type = '', category = '', month = '' } = {}) {
  const q = normalize(query.trim());
  return transactions.filter((tx) =>
    (!q || normalize(tx.description).includes(q)) &&
    (!type || tx.type === type) &&
    (!category || tx.category === category) &&
    (!month || tx.date.startsWith(month)));
}

/** Ordena por fecha descendente (más reciente primero) sin mutar el array original. */
export function sortByDateDesc(transactions) {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/**
 * Compara el gasto de cada categoría con su presupuesto mensual.
 * `budgets` es un objeto { categoría: céntimos }.
 */
export function budgetStatus(transactions, budgets, month) {
  const spent = totalsByCategory(filterTransactions(transactions, { type: 'expense', month }), 'expense');
  const spentMap = new Map(spent.map((s) => [s.category, s.total]));
  return Object.entries(budgets)
    .filter(([, limit]) => limit > 0)
    .map(([category, limit]) => {
      const used = spentMap.get(category) ?? 0;
      return { category, limit, used, ratio: used / limit, exceeded: used > limit };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
