/**
 * Estado de la aplicación con persistencia en localStorage y patrón observador.
 */
const STORAGE_KEY = 'finanzas:v1';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.transactions)) {
      return { transactions: data.transactions, budgets: data.budgets ?? {} };
    }
  } catch { /* almacenamiento no disponible o corrupto: se empieza de cero */ }
  return { transactions: [], budgets: {} };
}

export function createStore() {
  let state = load();
  const listeners = new Set();

  function commit(next) {
    state = next;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* modo privado */ }
    listeners.forEach((fn) => fn(state));
  }

  return {
    get: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    add(tx) { commit({ ...state, transactions: [...state.transactions, tx] }); },
    addMany(txs) { commit({ ...state, transactions: [...state.transactions, ...txs] }); },
    update(id, changes) {
      commit({ ...state, transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...changes } : t)) });
    },
    remove(id) { commit({ ...state, transactions: state.transactions.filter((t) => t.id !== id) }); },
    setBudget(category, cents) { commit({ ...state, budgets: { ...state.budgets, [category]: cents } }); },
    replaceAll(next) { commit({ transactions: next.transactions ?? [], budgets: next.budgets ?? {} }); },
  };
}
