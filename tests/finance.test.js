import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toCents, validateTransaction, isValidISODate, summarize, totalsByCategory,
  monthlySeries, filterTransactions, sortByDateDesc, budgetStatus,
} from '../src/finance.js';

const tx = (over) => ({
  id: Math.random().toString(36), description: 'x', category: 'Comida',
  type: 'expense', amount: 1000, date: '2026-05-10', createdAt: 0, ...over,
});

test('toCents acepta coma y punto decimal y rechaza texto inválido', () => {
  assert.equal(toCents('12,5'), 1250);
  assert.equal(toCents('0.1'), 10);
  assert.equal(toCents(' 1 000,99 '), 100099);
  assert.equal(toCents(19.99), 1999);
  assert.ok(Number.isNaN(toCents('abc')));
  assert.ok(Number.isNaN(toCents('1.234')));
});

test('validateTransaction detecta todos los campos inválidos', () => {
  assert.deepEqual(validateTransaction(tx()), []);
  const errors = validateTransaction({ description: ' ', amount: 0, type: 'otro', date: '2026-13-45', category: '' });
  assert.equal(errors.length, 5);
});

test('isValidISODate rechaza fechas inexistentes', () => {
  assert.equal(isValidISODate('2024-02-29'), true);
  assert.equal(isValidISODate('2026-02-29'), false);
  assert.equal(isValidISODate('2026-04-31'), false);
  assert.equal(isValidISODate('26-04-01'), false);
});

test('summarize calcula ingresos, gastos y balance', () => {
  const result = summarize([
    tx({ type: 'income', amount: 200000 }),
    tx({ amount: 50000 }),
    tx({ amount: 25050 }),
  ]);
  assert.deepEqual(result, { income: 200000, expense: 75050, balance: 124950 });
});

test('totalsByCategory agrupa y ordena de mayor a menor', () => {
  const result = totalsByCategory([
    tx({ category: 'Ocio', amount: 100 }),
    tx({ category: 'Comida', amount: 300 }),
    tx({ category: 'Ocio', amount: 400 }),
    tx({ category: 'Salario', type: 'income', amount: 9999 }),
  ]);
  assert.deepEqual(result, [
    { category: 'Ocio', total: 500 },
    { category: 'Comida', total: 300 },
  ]);
});

test('monthlySeries rellena meses vacíos e ignora los que quedan fuera del rango', () => {
  const series = monthlySeries([
    tx({ date: '2026-05-01', amount: 100 }),
    tx({ date: '2026-03-15', type: 'income', amount: 500 }),
    tx({ date: '2025-01-01', amount: 999 }),
  ], 3, new Date(2026, 4, 20));
  assert.deepEqual(series, [
    { month: '2026-03', income: 500, expense: 0 },
    { month: '2026-04', income: 0, expense: 0 },
    { month: '2026-05', income: 0, expense: 100 },
  ]);
});

test('monthlySeries cruza correctamente el cambio de año', () => {
  const series = monthlySeries([], 3, new Date(2026, 0, 15));
  assert.deepEqual(series.map((s) => s.month), ['2025-11', '2025-12', '2026-01']);
});

test('filterTransactions combina filtros e ignora los vacíos', () => {
  const data = [
    tx({ description: 'Supermercado Día', date: '2026-05-02' }),
    tx({ description: 'Cine', category: 'Ocio', date: '2026-05-03' }),
    tx({ description: 'Supermercado', date: '2026-04-02' }),
  ];
  assert.equal(filterTransactions(data).length, 3);
  assert.equal(filterTransactions(data, { query: 'SUPER' }).length, 2);
  assert.equal(filterTransactions(data, { query: 'súper' }).length, 2);
  assert.equal(filterTransactions(data, { query: 'dia' }).length, 1);
  assert.equal(filterTransactions(data, { query: 'super', month: '2026-05' }).length, 1);
  assert.equal(filterTransactions(data, { category: 'Ocio' }).length, 1);
});

test('sortByDateDesc no muta el array original', () => {
  const data = [tx({ date: '2026-01-01' }), tx({ date: '2026-03-01' })];
  const sorted = sortByDateDesc(data);
  assert.equal(sorted[0].date, '2026-03-01');
  assert.equal(data[0].date, '2026-01-01');
});

test('budgetStatus marca categorías excedidas y omite límites a 0', () => {
  const data = [
    tx({ category: 'Comida', amount: 30000, date: '2026-05-05' }),
    tx({ category: 'Ocio', amount: 5000, date: '2026-05-05' }),
    tx({ category: 'Comida', amount: 99999, date: '2026-04-05' }),
  ];
  const status = budgetStatus(data, { Comida: 25000, Ocio: 10000, Salud: 0 }, '2026-05');
  assert.equal(status.length, 2);
  assert.deepEqual(status[0], { category: 'Comida', limit: 25000, used: 30000, ratio: 1.2, exceeded: true });
  assert.equal(status[1].exceeded, false);
});
