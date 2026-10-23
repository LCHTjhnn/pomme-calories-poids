import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/core.js';
import '../src/history.js';

const C = globalThis.PommeCore;
const H = globalThis.PommeHistory;
const today = '2026-10-23';

function withDay(date, calories, limit = 2000) {
  const state = C.blankState();
  state.days[date] = { limit, entries: calories.map((kcal, index) => ({
    id: 'entry-' + index, name: 'Aliment', portion: '', kcal,
    createdAt: date + 'T12:00:00.000Z'
  })) };
  return state;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('past days at and below their quota are green, only a strictly exceeded quota is red', () => {
  for (const [calories, status, remaining, over] of [
    [[600, 700], 'ok', 700, false],
    [[1200, 800], 'ok', 0, false],
    [[1200, 800.01], 'over', -0.01, true]
  ]) {
    const summary = H.daySummary(withDay('2026-10-22', calories), '2026-10-22', today);
    assert.equal(summary.status, status);
    assert.equal(summary.over, over);
    assert.equal(summary.remaining, remaining);
    assert.equal(summary.count, 2);
    assert.equal(summary.hasEntries, true);
    assert.equal(summary.percent, status === 'over' ? 100 : summary.total / 2000 * 100);
  }
});

test('zero calorie entries are recorded days, while absent and stored empty days stay unclassified', () => {
  const zero = H.daySummary(withDay('2026-10-21', [0]), '2026-10-21', today);
  assert.equal(zero.status, 'ok');
  assert.equal(zero.hasEntries, true);
  assert.equal(zero.count, 1);
  assert.equal(zero.total, 0);
  assert.equal(zero.percent, 0);
  for (const state of [C.blankState(), withDay('2026-10-21', [], 1800)]) {
    const summary = H.daySummary(state, '2026-10-21', today);
    assert.equal(summary.status, 'missing');
    assert.equal(summary.hasEntries, false);
    assert.equal(summary.count, 0);
    assert.equal(summary.total, 0);
    assert.equal(summary.over, false);
  }
});

test('the recorded quota and core total are used, independently of today settings and retired step bonuses', () => {
  const state = withDay('2026-10-22', [900.01, 900.02], 1800);
  state.settings.limit = 2400;
  state.days['2026-10-22'].activity = { steps: 8000, baseline: 5000, enabled: true, weightKg: 70, bonusKcal: 70 };
  const summary = H.daySummary(state, '2026-10-22', today);
  assert.equal(summary.total, C.dayTotal(state.days['2026-10-22']));
  assert.equal(summary.limit, 1800);
  assert.equal(summary.status, 'over');
  assert.equal(summary.remaining, -0.03);
  assert.equal(summary.percent, 100);
  assert.equal(H.daySummary(state, '2026-10-20', today).limit, 2400);
});

test('today remains in progress, including an empty day or an exceeded quota', () => {
  for (const calories of [[], [0], [1200], [2500]]) {
    const summary = H.daySummary(withDay(today, calories), today, today);
    assert.equal(summary.status, 'current');
    assert.equal(summary.over, calories[0] === 2500);
    assert.equal(summary.hasEntries, calories.length > 0);
  }
});

test('future days are future even when an imported day contains entries', () => {
  const date = '2026-10-24';
  assert.equal(H.daySummary(C.blankState(), date, today).status, 'future');
  const recorded = H.daySummary(withDay(date, [2500]), date, today);
  assert.equal(recorded.status, 'future');
  assert.equal(recorded.over, true);
  assert.equal(recorded.total, 2500);
});

test('month cells use Monday-first weekdays, correct month lengths and Gregorian leap years', () => {
  const state = C.blankState();
  for (const [month, offset, count] of [
    ['2026-10', 3, 31], ['2026-02', 6, 28], ['2024-02', 3, 29],
    ['2026-06', 0, 30], ['1900-02', 3, 28], ['2000-02', 1, 29], ['2100-02', 0, 28]
  ]) {
    const result = H.monthCells(state, month, today);
    assert.equal(result.offset, offset, month);
    assert.equal(result.days.length, count, month);
    assert.equal(result.days[0].date, month + '-01');
    assert.equal(result.days.at(-1).date, month + '-' + count);
  }
  const october = H.monthCells(state, '2026-10', today);
  assert.equal(october.days[21].status, 'missing');
  assert.equal(october.days[22].status, 'current');
  assert.equal(october.days[23].status, 'future');
});

test('month shifting crosses years and stops at the supported boundaries', () => {
  assert.equal(H.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(H.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(H.shiftMonth('2026-03', 0), '2026-03');
  assert.equal(H.shiftMonth('2026-03', 24), '2028-03');
  assert.equal(H.shiftMonth('1900-01', -1), null);
  assert.equal(H.shiftMonth('9999-12', 1), null);
  assert.equal(H.shiftMonth('2026-03', Number.MAX_SAFE_INTEGER), null);
});

test('month selection retains the day number, clamps short months, and never passes today', () => {
  assert.equal(H.selectMonthDate('2026-10-15', '2026-09', today), '2026-09-15');
  assert.equal(H.selectMonthDate('2026-03-31', '2026-02', today), '2026-02-28');
  assert.equal(H.selectMonthDate('2024-03-31', '2024-02', today), '2024-02-29');
  assert.equal(H.selectMonthDate('2026-07-31', '2026-09', today), '2026-09-30');
  assert.equal(H.selectMonthDate('2026-08-31', '2026-10', today), today);
  assert.equal(H.selectMonthDate('2026-08-01', '2027-01', today), today);
});

test('calendar reads do not create days or mutate frozen legacy data', () => {
  const state = withDay('2026-10-22', [300], 1800);
  state.days['2026-10-21'] = { limit: 2100, entries: [] };
  state.settings.favoriteIds = ['cafe'];
  state.weights = [{ date: '2026-10-20', kg: 72 }];
  const before = JSON.stringify(state);
  deepFreeze(state);
  H.daySummary(state, today, today);
  H.monthCells(state, '2026-10', today);
  H.monthCells(state, '2024-02', today);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(Object.keys(state.days), ['2026-10-22', '2026-10-21']);
});

test('invalid dates, months, offsets and unreadable daily values are rejected', () => {
  const state = C.blankState();
  for (const date of ['', null, '2026-02-29', '2026-2-03', '2026-13-01', '__proto__']) {
    assert.throws(() => H.daySummary(state, date, today));
    assert.throws(() => H.daySummary(state, today, date));
    assert.throws(() => H.selectMonthDate(date, '2026-10', today));
  }
  for (const month of ['', null, '2026-2', '2026-00', '2026-13', '1899-12', '10000-01']) {
    assert.throws(() => H.monthCells(state, month, today));
    assert.throws(() => H.shiftMonth(month, 1));
    assert.throws(() => H.selectMonthDate(today, month, today));
  }
  for (const offset of [null, '1', 0.5, NaN, Infinity]) assert.throws(() => H.shiftMonth('2026-10', offset));
  for (const malformed of [null, {}, { settings: {}, days: [] }]) assert.throws(() => H.daySummary(malformed, today, today));
  for (const kcal of [-1, '20', NaN, Infinity]) assert.throws(() => H.daySummary(withDay(today, [kcal]), today, today));
});
