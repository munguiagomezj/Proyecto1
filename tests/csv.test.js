import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV, fromCSV, parseCSVRows } from '../src/csv.js';

let n = 0;
const makeId = () => `id-${++n}`;

test('exportar e importar conserva los datos (ida y vuelta)', () => {
  const original = [
    { id: 'a', date: '2026-05-01', description: 'Cena, "especial"', category: 'Ocio', type: 'expense', amount: 4550, createdAt: 1 },
    { id: 'b', date: '2026-05-02', description: 'Nómina', category: 'Salario', type: 'income', amount: 185000, createdAt: 2 },
  ];
  const { transactions, errors } = fromCSV(toCSV(original), makeId);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    transactions.map(({ id, createdAt, ...rest }) => rest),
    original.map(({ id, createdAt, ...rest }) => rest),
  );
});

test('parseCSVRows maneja comillas, saltos de línea internos y CRLF', () => {
  const rows = parseCSVRows('a,"b ""c""",d\r\n"línea\nnueva",e,f\r\n\r\n');
  assert.deepEqual(rows, [['a', 'b "c"', 'd'], ['línea\nnueva', 'e', 'f']]);
});

test('fromCSV informa de las líneas inválidas sin descartar las válidas', () => {
  const csv = [
    'fecha,descripcion,categoria,tipo,importe',
    '2026-05-01,Café,Comida,gasto,"2,50"',
    'mal-fecha,Algo,Comida,gasto,10',
    '2026-05-03,Bono,Salario,ingreso,-5',
  ].join('\n');
  const { transactions, errors } = fromCSV(csv, makeId);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].amount, 250);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /^Línea 3/);
});

test('fromCSV funciona también sin cabecera', () => {
  const { transactions } = fromCSV('2026-05-01,Café,Comida,expense,3', makeId);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].type, 'expense');
});
