// Run with: node test/solver.test.js
const assert = require('assert');
const { solve } = require('../js/solver.js');

const flat2 = { id: 'flat2', currency: 'cash', base: 2, rates: {} };
const flat15 = { id: 'flat15', currency: 'cash', base: 1.5, rates: {} };
const diner = { id: 'diner', currency: 'points', base: 1, rates: { dining: 4 } };
const grocer = { id: 'grocer', currency: 'cash', base: 1, rates: { groceries: { rate: 6, cap: 6000, per: 'year' } } };
const topcat = { id: 'topcat', currency: 'cash', base: 1, rates: {}, choice: { rate: 5, cap: 500, per: 'month', categories: ['dining', 'gas', 'groceries'] } };

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: got ${a}, expected ${b}`);
const spendOn = (r, id) => r.byCard.find(c => c.cardId === id).monthlySpend;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

test('one flat card earns its rate on everything', () => {
  const r = solve({ cards: [flat2], spend: { other: 1000 } });
  near(r.monthlyValue, 20, 'monthly value');
  near(r.annualValue, 240, 'annual value');
});

test('each category goes to the best card', () => {
  const r = solve({ cards: [flat2, diner], spend: { dining: 400, other: 600 } });
  near(r.monthlyValue, 400 * 0.04 + 600 * 0.02, 'monthly value');
  assert.strictEqual(spendOn(r, 'diner'), 400);
});

test('point value changes the answer', () => {
  const r = solve({ cards: [flat2, diner], spend: { dining: 400 }, pointValues: { points: 0.4 } });
  assert.strictEqual(spendOn(r, 'flat2'), 400); // 4 x 0.4c = 1.6c, worse than 2%
});

test('a capped bonus spills over to the next best card', () => {
  const r = solve({ cards: [grocer, flat2], spend: { groceries: 800 } });
  assert.strictEqual(spendOn(r, 'grocer'), 500);  // $6,000 a year = $500 a month
  assert.strictEqual(spendOn(r, 'flat2'), 300);
  near(r.monthlyValue, 500 * 0.06 + 300 * 0.02, 'monthly value');
});

test('share-of-spend ceiling is respected', () => {
  const r = solve({ cards: [flat2, flat15], spend: { other: 1000 }, rules: { sharePct: 50 } });
  assert.strictEqual(spendOn(r, 'flat2'), 500);
  assert.strictEqual(spendOn(r, 'flat15'), 500);
  assert.strictEqual(r.unassigned, 0);
});

test('ceiling pushes the least valuable spending off the best card', () => {
  // diner is best for dining only; flat2 best elsewhere but capped at 50%.
  const r = solve({ cards: [flat2, diner, flat15], spend: { dining: 200, other: 800 }, rules: { sharePct: 50 } });
  assert.strictEqual(spendOn(r, 'flat2'), 500);
  assert.strictEqual(spendOn(r, 'diner'), 200);
  assert.strictEqual(spendOn(r, 'flat15'), 300);
});

test('spending that no card has room for is reported, not hidden', () => {
  const r = solve({ cards: [flat2], spend: { other: 1000 }, rules: { sharePct: 50 } });
  assert.strictEqual(r.unassigned, 500);
  assert.ok(r.notes.some(n => n.type === 'unassigned'));
  near(r.monthlyValue, 10, 'value counts assigned spending only');
});

test('utilization ceiling uses the credit limit', () => {
  const r = solve({ cards: [flat2, flat15], spend: { other: 1000 }, rules: { util: { pct: 30, limits: { flat2: 1000 } } } });
  assert.strictEqual(spendOn(r, 'flat2'), 300);
  assert.strictEqual(spendOn(r, 'flat15'), 700);
});

test('welcome bonus target comes first', () => {
  const r = solve({ cards: [flat2, flat15], spend: { other: 1000 }, rules: { bonus: { cardId: 'flat15', spend: 1800, months: 3 } } });
  assert.strictEqual(spendOn(r, 'flat15'), 600);
  assert.ok(r.notes.some(n => n.type === 'bonus_on_track'));
  near(r.monthlyValue, 600 * 0.015 + 400 * 0.02, 'bonus pull is not counted as rewards');
});

test('welcome bonus puts the cheapest spending on the bonus card', () => {
  const r = solve({ cards: [diner, flat15], spend: { dining: 500, other: 500 }, rules: { bonus: { cardId: 'flat15', spend: 1500, months: 3 } } });
  assert.strictEqual(spendOn(r, 'diner'), 500); // dining stays on the 4x card
  assert.strictEqual(spendOn(r, 'flat15'), 500);
});

test('welcome bonus out of reach is flagged', () => {
  const r = solve({ cards: [flat2], spend: { other: 300 }, rules: { bonus: { cardId: 'flat2', spend: 4000, months: 3 } } });
  assert.ok(r.notes.some(n => n.type === 'bonus_short'));
});

test('welcome bonus blocked by a ceiling is flagged', () => {
  const r = solve({ cards: [flat2, flat15], spend: { other: 1000 }, rules: { sharePct: 40, bonus: { cardId: 'flat15', spend: 1800, months: 3 } } });
  assert.ok(r.notes.some(n => n.type === 'bonus_blocked'));
  assert.strictEqual(spendOn(r, 'flat15'), 400);
});

test('top-category card picks the category that gains most', () => {
  const r = solve({ cards: [topcat, diner], spend: { dining: 600, gas: 300, groceries: 450 } });
  assert.strictEqual(r.choices.topcat, 'groceries'); // dining already has a 4x home
  near(r.monthlyValue, 600 * 0.04 + 450 * 0.05 + 300 * 0.01, 'monthly value');
});

test('matches a per-category greedy answer when there are no card ceilings', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const cats = ['groceries', 'dining', 'gas', 'other'];
  for (let trial = 0; trial < 200; trial++) {
    const cards = [];
    for (let k = 0; k < 4; k++) {
      const rates = {};
      cats.forEach(c => { if (rand() < 0.4) rates[c] = 1 + Math.floor(rand() * 5); });
      cards.push({ id: 'c' + k, currency: 'cash', base: 1 + Math.floor(rand() * 2), rates });
    }
    const spend = {};
    cats.forEach(c => { spend[c] = Math.floor(rand() * 900); });
    let greedy = 0;
    cats.forEach(c => { greedy += spend[c] * Math.max(...cards.map(k => k.rates[c] ?? k.base)) / 100; });
    near(solve({ cards, spend }).monthlyValue, greedy, 'trial ' + trial);
  }
});

test('never beats an exhaustive search on small ceiling problems', () => {
  // Two categories, two cards, share ceiling: try every $50 split by brute force.
  const a = { id: 'a', currency: 'cash', base: 1, rates: { dining: 4, groceries: 3 } };
  const b = { id: 'b', currency: 'cash', base: 2, rates: {} };
  const spend = { dining: 400, groceries: 600 };
  const r = solve({ cards: [a, b], spend, rules: { sharePct: 60 } });
  let best = 0;
  for (let d = 0; d <= 400; d += 50) for (let g = 0; g <= 600; g += 50) {
    if (d + g > 600 || (1000 - d - g) > 600) continue;
    best = Math.max(best, d * 0.04 + g * 0.03 + (1000 - d - g) * 0.02);
  }
  near(r.monthlyValue, best, 'monthly value');
});

console.log(`\n${passed} tests passed`);
