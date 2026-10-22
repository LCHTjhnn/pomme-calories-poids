import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/core.js';

const core = globalThis.PommeCore;
const now = '2026-10-22T10:00:00.000Z';

function sample() {
  const state = core.blankState();
  state.days['2026-10-22'] = {
    limit: 1900,
    entries: [{ id: 'entry-1', name: 'Yaourt', portion: '1 pot', kcal: 90, createdAt: now, foodId: 'food-1' }]
  };
  state.foods = [{ id: 'food-1', name: 'Yaourt', kcal: 90, basis: 'portion', portionName: 'pot', defaultAmount: 1, emoji: '🥣' }];
  state.weights = [{ date: '2026-10-20', kg: 74.8 }, { date: '2026-10-22', kg: 74.5 }];
  state.settings.favoriteIds = ['food-1'];
  state.updatedAt = now;
  return state;
}

test('dates use calendar validation and the local timezone rather than UTC', () => {
  assert.equal(core.validDate('2024-02-29'), true);
  for (const invalid of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-2-03', '__proto__']) {
    assert.equal(core.validDate(invalid), false);
  }
  const date = new Date(2026, 9, 22, 0, 15);
  assert.equal(core.localDate(date), '2026-10-22');
  assert.throws(() => core.localDate(new Date('invalid')));
});

test('numeric input accepts French decimals but never silently truncates invalid input', () => {
  assert.equal(core.decimal(' 74,5 '), 74.5);
  assert.equal(core.decimal('.5'), 0.5);
  assert.equal(core.decimal(0), 0);
  for (const input of ['', ' ', '4,', '1.2.3', '200 kcal', '1e4', '1 000', null, Infinity]) {
    assert.equal(Number.isNaN(core.decimal(input)), true);
  }
});

test('portion calculations distinguish gram, ml and whole portions', () => {
  assert.equal(core.portionCalories({ kcal: 52, basis: '100g' }, '150'), 78);
  assert.equal(core.portionCalories({ kcal: 46, basis: '100ml' }, '250'), 115);
  assert.equal(core.portionCalories({ kcal: 90, basis: 'portion' }, '1,5'), 135);
  assert.throws(() => core.portionCalories({ kcal: 90, basis: 'portion' }, '-1'));
  assert.throws(() => core.portionCalories({ kcal: 90, basis: 'other' }, 1));
});

test('unit calories multiply quantities, including grams and fractional portions', () => {
  assert.equal(core.quantityCalories(40, 3), 120);
  assert.equal(core.quantityCalories(0.54, 150), 81);
  assert.equal(core.quantityCalories(90, 0.5), 45);
  assert.equal(core.quantityCalories('40,5', '1,5'), 60.75);
  assert.equal(core.quantityCalories(2.345, 3), 7.04);
  assert.equal(core.quantityCalories(0, 3), 0);
  assert.equal(core.quantityCalories(1, 100000), 100000);
  for (const [calories, quantity] of [
    [-1, 1], [100001, 1], [Infinity, 1], [40, 0], [40, -1],
    [40, 100001], [40, NaN], [100000, 2], ['40 kcal', 3], [40, '']
  ]) assert.throws(() => core.quantityCalories(calories, quantity));
});

test('catalogue portions and stored unit metadata use the identical rounding path', () => {
  for (const food of [
    { kcal: 54, basis: '100g' },
    { kcal: 46, basis: '100ml' },
    { kcal: 42.7, basis: '100g' },
    { kcal: 39.3, basis: '100ml' },
    { kcal: 40.5, basis: 'portion' }
  ]) {
    for (const quantity of [7.75, 32.75, 33.25, 0.5, 1.25, 150]) {
      const unitKcal = food.kcal / (food.basis === 'portion' ? 1 : 100);
      const kcal = core.portionCalories(food, quantity);
      assert.equal(kcal, core.quantityCalories(unitKcal, quantity));
      const state = sample();
      Object.assign(state.days['2026-10-22'].entries[0], {
        quantity, unitKcal, quantityUnit: food.basis === 'portion' ? 'portion' : food.basis === '100g' ? 'g' : 'ml', kcal
      });
      assert.equal(core.validateState(state).days['2026-10-22'].entries[0].kcal, kcal);
    }
  }
  assert.equal(core.portionCalories({ kcal: 54, basis: '100g' }, 7.75), 4.19);
});

test('legacy entries and exports keep their exact fields and are read through a nonmutating quantity fallback', () => {
  const legacy = sample();
  legacy.schemaVersion = 1;
  const entry = legacy.days['2026-10-22'].entries[0];
  const original = JSON.stringify(legacy);
  const details = core.entryQuantity(entry);
  assert.deepEqual(details, { quantity: 1, unitKcal: 90, quantityUnit: 'portion' });
  details.quantity = 3;
  assert.equal(JSON.stringify(legacy), original);
  const clean = core.validateState(legacy);
  assert.deepEqual(clean, { ...legacy, schemaVersion: 3 });
  assert.equal(Object.hasOwn(clean.days['2026-10-22'].entries[0], 'quantity'), false);
  const backup = { app: 'pomme', version: 1, exportedAt: now, data: legacy };
  assert.deepEqual(core.parseBackup(JSON.stringify(backup)), { ...legacy, schemaVersion: 3 });
  assert.equal(JSON.stringify(legacy), original);
});

test('food icons and quantity metadata survive an export/import roundtrip', () => {
  const state = sample();
  state.foods[0].emoji = '☕️';
  const entry = state.days['2026-10-22'].entries[0];
  Object.assign(entry, { quantity: 3, unitKcal: 40, quantityUnit: 'tasse', kcal: 120 });
  const restored = core.parseBackup(JSON.stringify(core.makeBackup(state)));
  assert.deepEqual(restored, state);
  assert.equal(restored.foods[0].emoji, '☕️');
  assert.deepEqual(core.entryQuantity(restored.days['2026-10-22'].entries[0]), { quantity: 3, unitKcal: 40, quantityUnit: 'tasse' });
  restored.days['2026-10-22'].entries[0].quantity = 2;
  assert.equal(entry.quantity, 3);
});

test('quantity metadata must be a complete valid group with a consistent rounded total', () => {
  const validDetails = { quantity: 150, unitKcal: 0.54, quantityUnit: 'g', kcal: 81 };
  for (const change of [
    entry => { delete entry.quantity; },
    entry => { delete entry.unitKcal; },
    entry => { delete entry.quantityUnit; },
    entry => { entry.quantity = 0; },
    entry => { entry.quantity = 100001; },
    entry => { entry.quantity = '150'; },
    entry => { entry.unitKcal = -1; },
    entry => { entry.unitKcal = 100001; },
    entry => { entry.quantityUnit = 'g'.repeat(81); },
    entry => { entry.quantityUnit = '<script>'; },
    entry => { entry.quantityUnit = ''; },
    entry => { entry.kcal = 82; }
  ]) {
    const state = sample();
    const entry = state.days['2026-10-22'].entries[0];
    Object.assign(entry, validDetails);
    change(entry);
    assert.throws(() => core.validateState(state));
  }
  const state = sample();
  Object.assign(state.days['2026-10-22'].entries[0], validDetails, { kcal: 81.00000000001 });
  assert.equal(core.validateState(state).days['2026-10-22'].entries[0].kcal, 81);
  const fractional = sample();
  Object.assign(fractional.days['2026-10-22'].entries[0], { quantity: 3, unitKcal: 2.345, quantityUnit: 'portion', kcal: 7.04 });
  assert.equal(core.validateState(fractional).days['2026-10-22'].entries[0].kcal, 7.04);
});

test('favorites allow nine, reject a tenth, and support idempotence, removal and replacement', () => {
  const state = core.blankState();
  assert.equal(core.MAX_FAVORITES, 9);
  for (let index = 1; index <= 9; index += 1) assert.equal(core.setFavorite(state, 'food-' + index, true), undefined);
  const full = [...state.settings.favoriteIds];
  assert.throws(() => core.setFavorite(state, 'food-10', true), /9 favoris/);
  assert.deepEqual(state.settings.favoriteIds, full);
  core.setFavorite(state, 'food-9', true);
  core.setFavorite(state, 'not-selected', false);
  assert.deepEqual(state.settings.favoriteIds, full);
  core.setFavorite(state, 'food-3', false);
  assert.equal(state.settings.favoriteIds.length, 8);
  core.setFavorite(state, 'food-10', true);
  assert.deepEqual(state.settings.favoriteIds, ['food-1', 'food-2', 'food-4', 'food-5', 'food-6', 'food-7', 'food-8', 'food-9', 'food-10']);
  assert.throws(() => core.setFavorite(state, '__proto__', true));
  assert.throws(() => core.setFavorite(state, 'food-1', 'true'));
});

test('existing states and backups with more than nine favorites remain intact', () => {
  const state = sample();
  state.schemaVersion = 1;
  state.settings.favoriteIds = Array.from({ length: 12 }, (_, index) => 'food-' + (index + 1));
  assert.deepEqual(core.validateState(state), { ...state, schemaVersion: 3 });
  assert.deepEqual(core.parseBackup(JSON.stringify(core.makeBackup(state))), { ...state, schemaVersion: 3 });
  const original = [...state.settings.favoriteIds];
  core.setFavorite(state, 'food-12', true);
  assert.deepEqual(state.settings.favoriteIds, original);
  assert.throws(() => core.setFavorite(state, 'food-13', true), /9 favoris/);
  core.setFavorite(state, 'food-12', false);
  assert.equal(state.settings.favoriteIds.length, 11);
  assert.deepEqual(core.validateState(state).settings.favoriteIds, original.slice(0, -1));
  assert.throws(() => core.setFavorite(state, 'food-13', true), /9 favoris/);
  for (const favorite of ['food-11', 'food-10', 'food-9']) core.setFavorite(state, favorite, false);
  core.setFavorite(state, 'food-13', true);
  assert.equal(state.settings.favoriteIds.length, 9);
});

test('an untouched day does not mutate storage and older daily limits stay fixed', () => {
  const state = sample();
  state.settings.limit = 2200;
  assert.equal(core.getDay(state, '2026-10-22').limit, 1900);
  const nextDay = core.getDay(state, '2026-10-23');
  assert.deepEqual(nextDay, { limit: 2200, entries: [] });
  nextDay.entries.push({ kcal: 100 });
  assert.equal(state.days['2026-10-23'], undefined);
  assert.equal(core.dayTotal(core.getDay(state, '2026-10-22')), 90);
  assert.equal(core.dayTotal({ entries: [{ kcal: 0.1 }, { kcal: 0.2 }] }), 0.3);
});

test('weight ordering is chronological without mutating the input', () => {
  const state = sample();
  state.weights.reverse();
  const before = JSON.stringify(state);
  assert.deepEqual(core.latestWeight(state), { date: '2026-10-22', kg: 74.5 });
  assert.equal(JSON.stringify(state), before);
  assert.equal(core.latestWeight(core.blankState()), null);
  assert.equal(core.validateState(state).weights[0].date, '2026-10-20');
});

test('format 1 and 2 migrations add only profile defaults and preserve all old day and food data', () => {
  for (const version of [1, 2]) {
    const legacy = sample();
    legacy.schemaVersion = version;
    for (const key of ['username', 'avatar', 'sex', 'age', 'stepsBaseline']) delete legacy.settings[key];
    if (version === 2) Object.assign(legacy.days['2026-10-22'].entries[0], {
      quantity: 3, unitKcal: 40, quantityUnit: 'tasse', kcal: 120
    });
    const before = JSON.stringify(legacy);
    const restored = core.parseBackup(JSON.stringify({ app: 'pomme', version, exportedAt: now, data: legacy }));
    assert.equal(restored.schemaVersion, 3);
    assert.deepEqual(restored.settings, {
      ...legacy.settings, username: '', avatar: '🍎', sex: '', age: null, stepsBaseline: null
    });
    assert.deepEqual(restored.days, legacy.days);
    assert.equal(Object.hasOwn(restored.days['2026-10-22'], 'activity'), false);
    assert.deepEqual(restored.foods, legacy.foods);
    assert.deepEqual(restored.weights, legacy.weights);
    assert.equal(restored.updatedAt, legacy.updatedAt);
    assert.equal(restored.lastBackupAt, legacy.lastBackupAt);
    assert.equal(JSON.stringify(legacy), before);
  }
});

test('profile fields and recorded activity survive backup roundtrip without a duplicate profile weight', () => {
  const state = sample();
  Object.assign(state.settings, { username: 'Johann', avatar: '🧑🏽‍🚀', sex: 'male', age: 42, height: 175, stepsBaseline: 5000 });
  state.weights.push({ date: '2020-01-01', kg: 75 });
  core.setDayActivity(state, '2020-01-02', { steps: 9000, baseline: 5000, enabled: true });
  const backup = core.makeBackup(state);
  assert.equal(backup.version, 3);
  const restored = core.parseBackup(JSON.stringify(backup));
  assert.deepEqual(restored, core.validateState(state));
  assert.deepEqual(restored.days['2020-01-02'].activity, {
    steps: 9000, baseline: 5000, enabled: true, weightKg: 75, bonusKcal: 100
  });
  assert.equal(Object.hasOwn(restored.settings, 'weight'), false);
  assert.equal(Object.hasOwn(restored.settings, 'weightKg'), false);
  assert.deepEqual(core.dayBudget(restored.days['2020-01-02']), { base: 2000, bonus: 0, total: 2000 });
});

test('a version 3 backup keeps all records and its old 70 kcal activity snapshot without adding it to the 2200 kcal budget', async () => {
  const legacy = sample();
  Object.assign(legacy.settings, {
    limit: 2200, username: 'Johann', avatar: '🧑🏽‍🚀', sex: 'male', age: 42, height: 175, stepsBaseline: 5000
  });
  const day = legacy.days['2026-10-22'];
  day.limit = 2200;
  day.activity = { steps: 8000, baseline: 5000, enabled: true, weightKg: 70, bonusKcal: 70 };
  Object.assign(day.entries[0], { quantity: 3, unitKcal: 40, quantityUnit: 'tasse', kcal: 120 });
  legacy.days['2026-10-21'] = { limit: 2100, entries: [] };
  legacy.lastBackupAt = now;
  const original = structuredClone(legacy);
  const backup = { app: 'pomme', version: 3, exportedAt: now, data: legacy };

  const restored = core.parseBackup(JSON.stringify(backup));
  assert.deepEqual(restored, original);
  assert.deepEqual(core.dayBudget(restored.days['2026-10-22']), { base: 2200, bonus: 0, total: 2200 });
  assert.deepEqual(core.dayBudget(restored.days['2026-10-21']), { base: 2100, bonus: 0, total: 2100 });
  assert.deepEqual(core.makeBackup(restored).data, original);
  assert.deepEqual(legacy, original);

  const fake = fakeDB();
  const write = core.writeDB(fake.db, restored);
  fake.transaction.oncomplete();
  assert.deepEqual(await write, original);
  assert.deepEqual(fake.request.result, original);

  const update = core.updateDB(fake.db, draft => { draft.settings.username = 'Jo'; });
  fake.request.onsuccess();
  fake.transaction.oncomplete();
  const saved = await update;
  const expected = structuredClone(original);
  expected.settings.username = 'Jo';
  assert.deepEqual(saved, expected);
  assert.deepEqual(core.parseBackup(JSON.stringify(core.makeBackup(saved))), expected);
  assert.equal(saved.days['2026-10-22'].activity.bonusKcal, 70);
  assert.equal(saved.settings.stepsBaseline, 5000);
  assert.equal(saved.schemaVersion, 3);
});

test('profile validation accepts optional fields and rejects invalid ranges, enums and text injection', () => {
  for (const sex of ['', 'female', 'male', 'other']) {
    const state = sample();
    state.settings.sex = sex;
    state.settings.username = '  Jo  ';
    assert.equal(core.validateState(state).settings.sex, sex);
    assert.equal(core.validateState(state).settings.username, 'Jo');
  }
  for (const [key, value] of [
    ['username', 'a'.repeat(41)], ['username', '<img src=x>'], ['username', 42],
    ['avatar', 'a'.repeat(33)], ['avatar', '<svg>'], ['avatar', ''],
    ['sex', 'unknown'], ['sex', null],
    ['age', 0], ['age', 121], ['age', 20.5], ['age', '42'], ['age', Infinity],
    ['stepsBaseline', -1], ['stepsBaseline', 100001], ['stepsBaseline', 4.5], ['stepsBaseline', '5000']
  ]) {
    const state = sample();
    state.settings[key] = value;
    assert.throws(() => core.validateState(state), key + ' accepts invalid value');
  }
});

test('step bonuses count only steps above the baseline and use bounded integer inputs', () => {
  assert.equal(core.estimateStepBonus(9000, 5000, 75), 100);
  assert.equal(core.estimateStepBonus(5000, 5000, 75), 0);
  assert.equal(core.estimateStepBonus(3000, 5000, 75), 0);
  assert.equal(core.estimateStepBonus(8001, 5000, 74.5), 75);
  assert.equal(core.estimateStepBonus(100000, 0, 1000), 33333);
  for (const inputs of [
    [-1, 0, 75], [100001, 0, 75], [1.5, 0, 75], ['8000', 0, 75], [Infinity, 0, 75],
    [8000, null, 75], [8000, -1, 75], [8000, 100001, 75], [8000, 1.5, 75],
    [8000, 5000, null], [8000, 5000, 0], [8000, 5000, 1001], [8000, 5000, NaN]
  ]) assert.throws(() => core.estimateStepBonus(...inputs));
});

test('dated weights exclude future measurements and work independently of input order', () => {
  const state = core.blankState();
  state.weights = [{ date: '2020-01-03', kg: 80 }, { date: '2020-01-01', kg: 75 }, { date: '2020-01-02', kg: 76 }];
  const before = JSON.stringify(state);
  assert.deepEqual(core.weightAtDate(state, '2020-01-02'), { date: '2020-01-02', kg: 76 });
  assert.deepEqual(core.weightAtDate(state, '2020-01-04'), { date: '2020-01-03', kg: 80 });
  assert.equal(core.weightAtDate(state, '2019-12-31'), null);
  assert.equal(core.weightAtDate(core.blankState(), '2020-01-01'), null);
  assert.equal(JSON.stringify(state), before);
  assert.throws(() => core.weightAtDate(state, '2020-02-31'));
});

test('legacy activity snapshots stay intact while only the recorded base limit determines the budget', () => {
  const state = sample();
  state.weights.push({ date: '2020-01-01', kg: 75 });
  const oldDays = JSON.stringify(state.days);
  core.setDayActivity(state, '2020-01-02', { steps: 9000, baseline: 5000, enabled: true });
  assert.equal(state.days['2020-01-02'].limit, 2000);
  const recorded = JSON.stringify(state.days['2020-01-02']);
  state.settings.limit = 2400;
  state.settings.stepsBaseline = 8000;
  state.settings.age = 50;
  state.weights.find(weight => weight.date === '2020-01-01').kg = 90;
  state.weights.push({ date: '2020-01-02', kg: 100 });
  const clean = core.validateState(state);
  assert.equal(JSON.stringify(clean.days['2020-01-02']), recorded);
  assert.deepEqual(core.dayBudget(clean.days['2020-01-02']), { base: 2000, bonus: 0, total: 2000 });
  assert.equal(JSON.stringify({ '2026-10-22': clean.days['2026-10-22'] }), oldDays);
  // An explicit edit of the day's steps records fresh inputs but keeps its base limit.
  core.setDayActivity(state, '2020-01-02', { steps: 9500, baseline: 8000, enabled: true });
  assert.deepEqual(core.dayBudget(state.days['2020-01-02']), { base: 2000, bonus: 0, total: 2000 });
  assert.equal(state.days['2020-01-02'].activity.bonusKcal, 50);
  assert.equal(state.days['2020-01-02'].activity.weightKg, 100);
});

test('tracking-only activity works without a weight or baseline and never adds calories', () => {
  const state = core.blankState();
  core.setDayActivity(state, '2020-01-01', { steps: 8000, baseline: null, enabled: false });
  assert.deepEqual(state.days['2020-01-01'].activity, {
    steps: 8000, baseline: null, enabled: false, weightKg: null, bonusKcal: 0
  });
  assert.deepEqual(core.dayBudget(core.validateState(state).days['2020-01-01']), { base: 2000, bonus: 0, total: 2000 });
  assert.deepEqual(core.dayBudget({ limit: 1800, entries: [] }), { base: 1800, bonus: 0, total: 1800 });
});

test('activity writes reject missing prerequisites, noninteger steps and future dates without partial mutation', () => {
  for (const [date, options] of [
    ['2020-01-01', { steps: 8000, baseline: 5000, enabled: true }],
    ['2020-01-01', { steps: 8000, baseline: null, enabled: true }],
    ['2020-01-01', { steps: 8000.5, baseline: 5000, enabled: false }],
    ['2020-01-01', { steps: Infinity, baseline: 5000, enabled: false }],
    ['2020-01-01', { steps: 8000, baseline: 5000, enabled: 'true' }],
    ['9999-12-31', { steps: 8000, baseline: 5000, enabled: false }],
    ['2020-02-31', { steps: 8000, baseline: 5000, enabled: false }]
  ]) {
    const state = sample();
    const before = JSON.stringify(state);
    assert.throws(() => core.setDayActivity(state, date, options));
    assert.equal(JSON.stringify(state), before);
  }
});

test('imports still validate archived activity while budgets are independent of the retired step feature', () => {
  const valid = { steps: 9000, baseline: 5000, enabled: true, weightKg: 75, bonusKcal: 100 };
  for (const mutation of [
    activity => { activity.bonusKcal = 101; },
    activity => { activity.bonusKcal = -100; },
    activity => { activity.bonusKcal = 100.5; },
    activity => { activity.steps = 9000.5; },
    activity => { activity.steps = Infinity; },
    activity => { activity.baseline = null; },
    activity => { activity.weightKg = null; },
    activity => { activity.enabled = false; },
    activity => { activity.enabled = 'true'; },
    activity => { delete activity.weightKg; },
    activity => { delete activity.bonusKcal; },
    activity => { Object.defineProperty(activity, '__proto__', { enumerable: true, value: { polluted: true } }); }
  ]) {
    const state = sample();
    const activity = { ...valid };
    mutation(activity);
    state.days['2026-10-22'].activity = activity;
    assert.throws(() => core.validateState(state));
    assert.deepEqual(core.dayBudget(state.days['2026-10-22']), { base: 1900, bonus: 0, total: 1900 });
  }
  const state = sample();
  state.days['2026-10-22'].activity = { ...valid, extra: '<img src=x>' };
  assert.deepEqual(core.validateState(state).days['2026-10-22'].activity, valid);
  assert.equal({}.polluted, undefined);
});

test('backup roundtrip rebuilds allowed properties and is independent of the source', () => {
  const state = sample();
  state.unexpected = 'ignored';
  state.settings.secret = 'ignored';
  state.foods[0].unexpected = 'ignored';
  const restored = core.parseBackup(JSON.stringify(core.makeBackup(state)));
  assert.equal(restored.unexpected, undefined);
  assert.equal(restored.settings.secret, undefined);
  assert.equal(restored.foods[0].unexpected, undefined);
  restored.foods[0].kcal = 120;
  assert.equal(state.foods[0].kcal, 90);
  assert.equal(restored.days['2026-10-22'].entries[0].kcal, 90);
});

test('backup versions, missing data, invalid dates and nonnumeric values are rejected', () => {
  assert.throws(() => core.parseBackup('{oops'));
  assert.throws(() => core.parseBackup(JSON.stringify({ app: 'other', version: 1, data: sample() })));
  for (const version of [0, 4]) {
    assert.throws(() => core.parseBackup(JSON.stringify({ app: 'pomme', version, exportedAt: now, data: sample() })));
  }
  for (const mutate of [
    state => { state.schemaVersion = 0; },
    state => { state.schemaVersion = 4; },
    state => { state.settings.limit = '2000'; },
    state => { state.settings.height = -1; },
    state => { state.weights[0].kg = NaN; },
    state => { state.weights[0].date = '2026-02-30'; },
    state => { state.foods[0].defaultAmount = 0; },
    state => { state.days['2026-10-22'].entries[0].kcal = -10; },
    state => { state.days['2026-10-22'].entries[0].createdAt = 'yesterday'; },
    state => { state.updatedAt = undefined; }
  ]) {
    const state = sample();
    mutate(state);
    assert.throws(() => core.validateState(state));
  }
});

test('new backups and writes use data format 3 while format 1 backups remain readable', async () => {
  const legacy = sample();
  legacy.schemaVersion = 1;
  const exported = core.makeBackup(legacy);
  assert.equal(core.SCHEMA_VERSION, 3);
  assert.equal(core.blankState().schemaVersion, 3);
  assert.equal(exported.version, 3);
  assert.equal(exported.data.schemaVersion, 3);
  assert.deepEqual(exported.data, { ...legacy, schemaVersion: 3 });
  assert.deepEqual(core.parseBackup(JSON.stringify(exported)), exported.data);
  const oldBackup = { app: 'pomme', version: 1, exportedAt: now, data: legacy };
  assert.deepEqual(core.parseBackup(JSON.stringify(oldBackup)), exported.data);
  const fake = fakeDB(legacy);
  const write = core.writeDB(fake.db, legacy);
  fake.transaction.oncomplete();
  const saved = await write;
  assert.deepEqual(saved, exported.data);
  assert.equal(fake.request.result.schemaVersion, 3);
  assert.equal(legacy.schemaVersion, 1);
});

test('duplicate identifiers and weight dates cannot double-count an import', () => {
  for (const mutate of [
    state => { state.weights.push({ date: '2026-10-22', kg: 75 }); },
    state => { state.foods.push({ ...state.foods[0] }); },
    state => { state.settings.favoriteIds.push('food-1'); },
    state => { state.days['2026-10-23'] = { limit: 2000, entries: [{ ...state.days['2026-10-22'].entries[0] }] }; }
  ]) {
    const state = sample();
    mutate(state);
    assert.throws(() => core.validateState(state));
  }
});

test('HTML-bearing fields and prototype pollution keys are rejected', () => {
  const state = sample();
  state.foods[0].name = '<img src=x onerror=alert(1)>';
  assert.throws(() => core.validateState(state));
  const malicious = JSON.parse(JSON.stringify(sample()));
  Object.defineProperty(malicious.settings, '__proto__', { enumerable: true, value: { polluted: true } });
  assert.throws(() => core.validateState(malicious));
  assert.equal({}.polluted, undefined);
});

test('source metadata preserves attribution and excludes executable URLs', () => {
  const state = sample();
  state.foods[0].source = { label: 'ANSES Ciqual', url: 'https://ciqual.anses.fr/', code: '1234', unknown: true };
  const source = core.validateState(state).foods[0].source;
  assert.deepEqual(source, { label: 'ANSES Ciqual', url: 'https://ciqual.anses.fr/', code: '1234' });
  state.foods[0].source.url = 'javascript:alert(1)';
  assert.throws(() => core.validateState(state));
});

test('backup size limit uses UTF-8 bytes, including multibyte characters', () => {
  assert.throws(() => core.parseBackup('x'.repeat(core.MAX_BACKUP_BYTES + 1)), /5 Mo/);
  assert.throws(() => core.parseBackup('🥑'.repeat(Math.ceil(core.MAX_BACKUP_BYTES / 4) + 1)), /5 Mo/);
});

test('duplicate JSON day keys and escaped duplicate names are rejected before import', () => {
  const backup = core.makeBackup(sample());
  const text = JSON.stringify(backup);
  const day = JSON.stringify(backup.data.days['2026-10-22']);
  const duplicate = text.replace('"days":{', '"days":{"2026-10-22":' + day + ',');
  assert.throws(() => core.parseBackup(duplicate), /double/);
  assert.throws(() => core.parseBackup(text.replace('"app":"pomme"', '"app":"pomme","\\u0061pp":"pomme"')), /double/);
  const withPunctuation = sample();
  withPunctuation.foods[0].name = 'Crème "A", {B} [C] \\ vanille';
  assert.equal(core.parseBackup(JSON.stringify(core.makeBackup(withPunctuation))).foods[0].name, withPunctuation.foods[0].name);
});

function fakeDB(result) {
  const request = { result, error: null };
  const operations = [];
  const transaction = {
    error: null,
    aborted: false,
    abort() { this.aborted = true; this.onabort?.(); },
    objectStore(store) {
      operations.push({ action: 'objectStore', store });
      return {
        get(key) { operations.push({ action: 'get', key }); return request; },
        put(value, key) { operations.push({ action: 'put', key }); request.result = value; return request; }
      };
    }
  };
  const db = { transaction(store, mode) { operations.push({ action: 'transaction', store, mode }); return transaction; } };
  return { db, transaction, request, operations };
}

test('the existing IndexedDB name, version, store and singleton key stay compatible', async () => {
  const legacy = sample();
  legacy.schemaVersion = 1;
  legacy.settings.favoriteIds = Array.from({ length: 12 }, (_, index) => 'food-' + (index + 1));
  const fake = fakeDB(legacy);
  let opened;
  const openRequest = { result: fake.db };
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = { open(name, version) { opened = { name, version }; return openRequest; } };
  try {
    const connection = core.openDB();
    openRequest.onsuccess();
    assert.equal(await connection, fake.db);
    assert.deepEqual(opened, { name: 'pomme-local-v1', version: 1 });
    const read = core.readDB(fake.db);
    fake.request.onsuccess();
    fake.transaction.oncomplete();
    assert.deepEqual(await read, { ...legacy, schemaVersion: 3 });
    const update = core.updateDB(fake.db, draft => { draft.settings.height = 175; });
    fake.request.onsuccess();
    fake.transaction.oncomplete();
    const updated = await update;
    assert.equal(updated.schemaVersion, 3);
    assert.deepEqual(updated.settings.favoriteIds, legacy.settings.favoriteIds);
    assert.deepEqual(updated.days, legacy.days);
    assert.deepEqual(updated.foods, legacy.foods);
    for (const operation of fake.operations) {
      if (operation.store !== undefined) assert.equal(operation.store, 'state');
      if (operation.key !== undefined) assert.equal(operation.key, 'singleton');
    }
    assert.equal(fake.operations.some(operation => operation.action === 'put'), true);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test('write resolves only on transaction commit, never on a successful put', async () => {
  const fake = fakeDB();
  let saved = false;
  const pending = core.writeDB(fake.db, sample()).then(() => { saved = true; });
  fake.request.onsuccess?.();
  await Promise.resolve();
  assert.equal(saved, false);
  fake.transaction.oncomplete();
  await pending;
  assert.equal(saved, true);
});

test('quota or abort failures reject instead of reporting a save', async () => {
  const fake = fakeDB();
  const pending = core.writeDB(fake.db, sample());
  fake.transaction.error = Object.assign(new Error('Stockage plein'), { name: 'QuotaExceededError' });
  fake.transaction.onabort();
  await assert.rejects(pending, { name: 'QuotaExceededError' });
});

test('read waits for completion and rejects corrupt persisted state', async () => {
  const fake = fakeDB(sample());
  const pending = core.readDB(fake.db);
  fake.request.onsuccess();
  fake.transaction.oncomplete();
  assert.equal((await pending).weights.length, 2);
  const empty = fakeDB(undefined);
  const emptyRead = core.readDB(empty.db);
  empty.request.onsuccess();
  empty.transaction.oncomplete();
  assert.equal(await emptyRead, null);
  const corrupt = fakeDB({ schemaVersion: 900 });
  const corruptRead = core.readDB(corrupt.db);
  corrupt.request.onsuccess();
  corrupt.transaction.oncomplete();
  await assert.rejects(corruptRead, /version/);
});

test('unavailable IndexedDB is surfaced without a silent storage fallback', async () => {
  const previous = globalThis.indexedDB;
  delete globalThis.indexedDB;
  try { await assert.rejects(core.openDB(), /indisponible/); }
  finally { if (previous !== undefined) globalThis.indexedDB = previous; }
});

test('atomic updates read the latest stored state, preserve unrelated changes and wait for commit', async () => {
  const persisted = sample();
  persisted.settings.height = 178;
  const fake = fakeDB(persisted);
  let saved = false;
  const pending = core.updateDB(fake.db, draft => { draft.settings.limit = 2100; })
    .then(result => { saved = true; return result; });
  fake.request.onsuccess();
  await Promise.resolve();
  assert.equal(saved, false);
  assert.equal(persisted.settings.limit, 2000);
  fake.transaction.oncomplete();
  const result = await pending;
  assert.equal(result.settings.limit, 2100);
  assert.equal(result.settings.height, 178);
  assert.equal(result.days['2026-10-22'].limit, 1900);
});

test('atomic updates initialize a blank store and abort invalid or asynchronous mutations', async () => {
  const empty = fakeDB(undefined);
  const initial = core.updateDB(empty.db, draft => { draft.weights.push({ date: '2026-10-22', kg: 75 }); });
  empty.request.onsuccess();
  empty.transaction.oncomplete();
  assert.equal((await initial).weights.length, 1);
  for (const mutate of [
    draft => { draft.settings.limit = -10; },
    async draft => { draft.settings.limit = 2200; }
  ]) {
    const fake = fakeDB(sample());
    const pending = core.updateDB(fake.db, mutate);
    fake.request.onsuccess();
    await assert.rejects(pending);
    assert.equal(fake.transaction.aborted, true);
  }
});
