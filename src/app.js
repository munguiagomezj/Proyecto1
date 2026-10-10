/**
 * Capa de interfaz: conecta el DOM con el store y la lógica de negocio.
 */
import {
  CATEGORIES, toCents, formatMoney, validateTransaction, summarize, totalsByCategory,
  monthlySeries, filterTransactions, sortByDateDesc, budgetStatus,
} from './finance.js';
import { toCSV, fromCSV } from './csv.js';
import { drawDonut, drawBars, PALETTE } from './chart.js';
import { createStore } from './store.js';
import { generateDemoData } from './demo.js';

const store = createStore();
const $ = (sel) => document.querySelector(sel);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const currentMonth = () => today().slice(0, 7);
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const form = $('#tx-form');
const filters = { query: '', type: '', category: '', month: '' };
let editingId = null;
const PAGE_SIZE = 15;
let visibleCount = PAGE_SIZE;

// ---------- Utilidades de UI ----------

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function fillCategorySelect(select, type, placeholder) {
  const groups = type ? { [type]: CATEGORIES[type] } : CATEGORIES;
  const labels = { income: 'Ingresos', expense: 'Gastos' };
  select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
    Object.entries(groups).map(([t, cats]) =>
      `<optgroup label="${labels[t]}">${cats.map((c) => `<option>${c}</option>`).join('')}</optgroup>`).join('');
}

// ---------- Formulario ----------

function selectedType() {
  return form.elements.type.value;
}

function resetForm() {
  editingId = null;
  form.reset();
  form.elements.date.value = today();
  fillCategorySelect(form.elements.category, selectedType());
  $('#form-title').textContent = 'Nueva transacción';
  $('#submit-btn').textContent = 'Añadir';
  $('#cancel-edit').hidden = true;
  $('#form-errors').innerHTML = '';
}

function startEdit(id) {
  const tx = store.get().transactions.find((t) => t.id === id);
  if (!tx) return;
  editingId = id;
  form.elements.type.value = tx.type;
  fillCategorySelect(form.elements.category, tx.type);
  form.elements.description.value = tx.description;
  form.elements.amount.value = (tx.amount / 100).toFixed(2).replace('.', ',');
  form.elements.date.value = tx.date;
  form.elements.category.value = tx.category;
  $('#form-title').textContent = 'Editar transacción';
  $('#submit-btn').textContent = 'Guardar cambios';
  $('#cancel-edit').hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.elements.description.focus();
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'type') fillCategorySelect(form.elements.category, selectedType());
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const tx = {
    type: data.get('type'),
    description: data.get('description').trim(),
    amount: toCents(data.get('amount')),
    date: data.get('date'),
    category: data.get('category'),
  };
  const errors = validateTransaction(tx);
  if (errors.length) {
    $('#form-errors').innerHTML = errors.map((err) => `<li>${err}</li>`).join('');
    return;
  }
  if (editingId) {
    store.update(editingId, tx);
    toast('Transacción actualizada');
  } else {
    store.add({ ...tx, id: crypto.randomUUID(), createdAt: Date.now() });
    toast('Transacción añadida');
  }
  resetForm();
});

$('#cancel-edit').addEventListener('click', resetForm);

// ---------- Lista y filtros ----------

$('#f-query').addEventListener('input', (e) => { filters.query = e.target.value; resetPaging(); });
$('#f-type').addEventListener('change', (e) => { filters.type = e.target.value; resetPaging(); });
$('#f-category').addEventListener('change', (e) => { filters.category = e.target.value; resetPaging(); });
$('#f-month').addEventListener('change', (e) => { filters.month = e.target.value; resetPaging(); });

function resetPaging() {
  visibleCount = PAGE_SIZE;
  renderList();
}

$('#more-btn').addEventListener('click', () => {
  visibleCount += PAGE_SIZE;
  renderList();
});

$('#tx-body').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { id, action } = btn.dataset;
  if (action === 'edit') startEdit(id);
  if (action === 'delete' && confirm('¿Eliminar esta transacción?')) {
    store.remove(id);
    if (editingId === id) resetForm();
    toast('Transacción eliminada');
  }
});

function renderList() {
  const { transactions } = store.get();
  const rows = sortByDateDesc(filterTransactions(transactions, filters));
  $('#tx-body').innerHTML = rows.slice(0, visibleCount).map((tx) => `
    <tr>
      <td>${new Date(tx.date + 'T00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td>${escapeHTML(tx.description)}</td>
      <td><span class="tag">${escapeHTML(tx.category)}</span></td>
      <td class="num ${tx.type}">${tx.type === 'expense' ? '−' : '+'}${formatMoney(tx.amount)}</td>
      <td class="row-actions">
        <button class="btn icon small" data-action="edit" data-id="${tx.id}" aria-label="Editar">✏️</button>
        <button class="btn icon small" data-action="delete" data-id="${tx.id}" aria-label="Eliminar">🗑️</button>
      </td>
    </tr>`).join('');
  $('#empty').hidden = rows.length > 0;
  $('#more-btn').hidden = rows.length <= visibleCount;
  $('#list-count').textContent = `${Math.min(rows.length, visibleCount)} de ${rows.length}` +
    (rows.length !== transactions.length ? ` (filtrados de ${transactions.length})` : '');
}

// ---------- Resumen y gráficos ----------

function renderSummary() {
  const { income, expense, balance } = summarize(store.get().transactions);
  $('#stat-balance').textContent = formatMoney(balance);
  $('#stat-balance').classList.toggle('negative', balance < 0);
  $('#stat-income').textContent = formatMoney(income);
  $('#stat-expense').textContent = formatMoney(expense);
  $('#stat-savings').textContent = income > 0 ? `${Math.round((balance / income) * 100)} %` : '—';
}

function renderCharts() {
  const { transactions } = store.get();
  const byCat = totalsByCategory(transactions, 'expense');
  const total = byCat.reduce((s, c) => s + c.total, 0);
  drawDonut($('#donut'), byCat.map((c) => ({ label: c.category, value: c.total })), formatMoney(total));
  $('#donut-legend').innerHTML = byCat.length
    ? byCat.map((c, i) => `
      <li><i style="background:${PALETTE[i % PALETTE.length]}"></i>
        <span>${escapeHTML(c.category)}</span>
        <strong>${Math.round((c.total / total) * 100)} %</strong></li>`).join('')
    : '<li class="muted">Sin gastos todavía</li>';

  const series = monthlySeries(transactions, 6).map((m) => ({
    label: MONTH_NAMES[Number(m.month.slice(5)) - 1],
    a: m.income,
    b: m.expense,
  }));
  drawBars($('#bars'), series);
}

// ---------- Presupuestos ----------

function renderBudgets() {
  const { transactions, budgets } = store.get();
  const status = budgetStatus(transactions, budgets, currentMonth());
  $('#budget-list').innerHTML = status.length
    ? status.map((b) => {
      const pct = Math.min(100, Math.round(b.ratio * 100));
      const level = b.exceeded ? 'over' : b.ratio >= 0.8 ? 'warn' : 'ok';
      return `
        <li class="${level}">
          <div class="budget-row"><span>${escapeHTML(b.category)}</span>
            <span>${formatMoney(b.used)} / ${formatMoney(b.limit)}</span></div>
          <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
               aria-label="${escapeHTML(b.category)}"><span style="width:${pct}%"></span></div>
        </li>`;
    }).join('')
    : '<li class="muted">Pulsa «Editar» para fijar límites mensuales por categoría.</li>';
}

function renderBudgetForm() {
  const { budgets } = store.get();
  $('#budget-form').innerHTML = CATEGORIES.expense.map((c) => `
    <label class="budget-input">${c}
      <input name="${c}" inputmode="decimal" placeholder="Sin límite"
             value="${budgets[c] ? (budgets[c] / 100).toFixed(2).replace('.', ',') : ''}">
    </label>`).join('') + '<button class="btn primary" type="submit">Guardar presupuestos</button>';
}

$('#budget-toggle').addEventListener('click', () => {
  const formEl = $('#budget-form');
  formEl.hidden = !formEl.hidden;
  $('#budget-toggle').textContent = formEl.hidden ? 'Editar' : 'Cerrar';
  if (!formEl.hidden) renderBudgetForm();
});

$('#budget-form').addEventListener('submit', (e) => {
  e.preventDefault();
  for (const [category, value] of new FormData(e.target)) {
    const cents = value.trim() ? toCents(value) : 0;
    store.setBudget(category, Number.isNaN(cents) ? 0 : Math.max(0, cents));
  }
  e.target.hidden = true;
  $('#budget-toggle').textContent = 'Editar';
  toast('Presupuestos guardados');
});

// ---------- Importar / exportar / demo / tema ----------

$('#export-btn').addEventListener('click', () => {
  const { transactions } = store.get();
  if (!transactions.length) return toast('No hay datos que exportar');
  const blob = new Blob([toCSV(sortByDateDesc(transactions))], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `finanzas-${today()}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#import-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const { transactions, errors } = fromCSV(await file.text());
  if (transactions.length) store.addMany(transactions);
  toast(`${transactions.length} importadas${errors.length ? `, ${errors.length} con errores` : ''}`);
  if (errors.length) console.warn('Errores de importación:\n' + errors.join('\n'));
  e.target.value = '';
});

$('#demo-btn').addEventListener('click', () => {
  if (store.get().transactions.length && !confirm('Esto reemplazará tus datos actuales. ¿Continuar?')) return;
  store.replaceAll(generateDemoData());
  resetForm();
  toast('Datos de ejemplo cargados');
});

$('#theme-btn').addEventListener('click', () => {
  const root = document.documentElement;
  const isDark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = isDark ? 'light' : 'dark';
  try { localStorage.setItem('finanzas:theme', root.dataset.theme); } catch { /* sin persistencia */ }
  renderCharts();
});

// ---------- Arranque ----------

function render() {
  renderSummary();
  renderCharts();
  renderBudgets();
  renderList();
}

fillCategorySelect($('#f-category'), '', 'Todas las categorías');
resetForm();
store.subscribe(render);
render();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderCharts, 150);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderCharts);
