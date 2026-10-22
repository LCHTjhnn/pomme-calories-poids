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
  assert.throws(() => core.parseBackup(JSON.stringify({ app: 'pomme', version: 2, data: sample() })));
  for (const mutate of [
    state => { state.schemaVersion = 2; },
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
  const transaction = {
    error: null,
    aborted: false,
    abort() { this.aborted = true; this.onabort?.(); },
    objectStore() {
      return {
        get() { return request; },
        put(value) { request.result = value; return request; }
      };
    }
  };
  const db = { transaction() { return transaction; } };
  return { db, transaction, request };
}

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
