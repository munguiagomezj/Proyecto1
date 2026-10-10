/**
 * Genera datos de ejemplo realistas para los últimos 6 meses.
 */
const TEMPLATES = [
  { type: 'income', category: 'Salario', description: 'Nómina', min: 1850, max: 1850, day: 1 },
  { type: 'expense', category: 'Vivienda', description: 'Alquiler', min: 650, max: 650, day: 3 },
  { type: 'expense', category: 'Suscripciones', description: 'Streaming y música', min: 18, max: 18, day: 5 },
  { type: 'expense', category: 'Transporte', description: 'Abono transporte', min: 40, max: 40, day: 2 },
  { type: 'expense', category: 'Vivienda', description: 'Luz e internet', min: 70, max: 110, day: 10 },
  { type: 'expense', category: 'Comida', description: 'Supermercado', min: 45, max: 90, day: 6 },
  { type: 'expense', category: 'Comida', description: 'Supermercado', min: 45, max: 90, day: 14 },
  { type: 'expense', category: 'Comida', description: 'Supermercado', min: 45, max: 90, day: 22 },
  { type: 'expense', category: 'Ocio', description: 'Cena con amigos', min: 25, max: 60, day: 12 },
  { type: 'expense', category: 'Ocio', description: 'Cine', min: 9, max: 18, day: 19 },
  { type: 'expense', category: 'Salud', description: 'Gimnasio', min: 35, max: 35, day: 1 },
  { type: 'expense', category: 'Educación', description: 'Curso online', min: 15, max: 40, day: 16 },
  { type: 'income', category: 'Freelance', description: 'Proyecto freelance', min: 150, max: 450, day: 20, chance: 0.6 },
];

export function generateDemoData(months = 6, now = new Date(), random = Math.random) {
  const transactions = [];
  for (let m = months - 1; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1);
    for (const t of TEMPLATES) {
      if (t.chance && random() > t.chance) continue;
      const date = new Date(base.getFullYear(), base.getMonth(), t.day);
      if (date > now) continue;
      const euros = t.min + random() * (t.max - t.min);
      transactions.push({
        id: crypto.randomUUID(),
        type: t.type,
        category: t.category,
        description: t.description,
        amount: Math.round(euros * 100),
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        createdAt: date.getTime(),
      });
    }
  }
  const budgets = { Comida: 25000, Ocio: 10000, Transporte: 5000, Suscripciones: 2000 };
  return { transactions, budgets };
}
