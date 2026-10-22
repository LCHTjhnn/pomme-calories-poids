(function (root) {
  'use strict';

  const DB_NAME = 'pomme-local-v1';
  const STORE_NAME = 'state';
  const STATE_KEY = 'singleton';
  // Data format only: keep the IndexedDB name/version/store unchanged. Older
  // app tabs reject newer formats instead of discarding unknown fields on writes.
  const SCHEMA_VERSION = 3;
  const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
  const MAX_DAYS = 20000;
  const MAX_WEIGHTS = 20000;
  const MAX_FOODS = 2000;
  const MAX_FAVORITES = 9;
  const MAX_ENTRIES_PER_DAY = 1000;
  const FORBIDDEN_KEYS = ['__proto__', 'prototype', 'constructor'];

  function invalid(message) {
    throw new Error('Données invalides : ' + message);
  }

  function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) invalid(label);
    if (FORBIDDEN_KEYS.some(key => Object.prototype.hasOwnProperty.call(value, key))) {
      invalid(label + ' contient une propriété interdite.');
    }
    return value;
  }

  function text(value, label, maxLength, allowEmpty) {
    if (typeof value !== 'string') invalid(label);
    const clean = value.trim();
    if ((!allowEmpty && !clean) || clean.length > maxLength || /[<>\u0000-\u001f\u007f]/.test(clean)) {
      invalid(label + ' doit être un texte simple.');
    }
    return clean;
  }

  function id(value, label) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(value) || FORBIDDEN_KEYS.includes(value)) {
      invalid(label);
    }
    return value;
  }

  function number(value, min, max, label, exclusiveMin) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value > max || (exclusiveMin ? value <= min : value < min)) {
      invalid(label + ' est hors limites.');
    }
    return value;
  }

  function integer(value, min, max, label) {
    number(value, min, max, label);
    if (!Number.isInteger(value)) invalid(label + ' doit être un nombre entier.');
    return value;
  }

  function list(value, max, label) {
    if (!Array.isArray(value) || value.length > max) invalid(label);
    return value;
  }

  function sourceValue(value) {
    if (typeof value === 'string') return text(value, 'la source de l’aliment', 500, true);
    record(value, 'la source de l’aliment');
    const clean = { label: text(value.label, 'le nom de la source', 200, false) };
    const url = text(value.url, 'le lien de la source', 1000, false);
    let parsed;
    try { parsed = new URL(url); }
    catch (_) { invalid('le lien de la source'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) invalid('le lien de la source');
    clean.url = parsed.href;
    if (value.code !== undefined) clean.code = text(value.code, 'le code de la source', 100, true);
    return clean;
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function dateValue(value, label) {
    if (!validDate(value)) invalid(label + ' doit être une date valide (AAAA-MM-JJ).');
    return value;
  }

  function timestamp(value, label, nullable) {
    if (nullable && value === null) return null;
    if (typeof value !== 'string' || value.length > 40 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !validDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) invalid(label);
    return new Date(value).toISOString();
  }

  function localDate(date = new Date()) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('Date incorrecte.');
    return String(date.getFullYear()).padStart(4, '0') + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  // Invalid or incomplete numeric input deliberately returns NaN, never zero.
  function decimal(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value !== 'string') return NaN;
    const clean = value.trim();
    if (!/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(clean)) return NaN;
    const result = Number(clean.replace(',', '.'));
    return Number.isFinite(result) ? result : NaN;
  }

  function blankState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: { limit: 2000, height: null, favoriteIds: [], username: '', avatar: '🍎', sex: '', age: null, stepsBaseline: null },
      days: {},
      foods: [],
      weights: [],
      updatedAt: null,
      lastBackupAt: null
    };
  }

  // The limit only applies to new selections. Older saved lists stay intact.
  function setFavorite(state, favoriteId, selected) {
    const settings = record(state.settings, 'les réglages');
    const cleanId = id(favoriteId, 'un identifiant de favori');
    if (typeof selected !== 'boolean') invalid('la sélection du favori');
    const favorites = settings.favoriteIds === undefined ? [] : list(settings.favoriteIds, MAX_FOODS, 'les favoris');
    const alreadySelected = favorites.includes(cleanId);
    if (selected && !alreadySelected) {
      if (favorites.length >= MAX_FAVORITES) {
        throw new Error('Vous pouvez sélectionner jusqu’à 9 favoris. Retirez-en un avant d’en ajouter.');
      }
      settings.favoriteIds = favorites.concat(cleanId);
    } else if (!selected && alreadySelected) settings.favoriteIds = favorites.filter(value => value !== cleanId);
  }

  function hasQuantityMetadata(entry) {
    return ['quantity', 'unitKcal', 'quantityUnit'].some(key => Object.prototype.hasOwnProperty.call(entry, key));
  }

  // Rebuild the complete persisted schema; no spread/merge of imported objects.
  function validateState(input) {
    record(input, 'la sauvegarde');
    if (![1, 2, SCHEMA_VERSION].includes(input.schemaVersion)) invalid('version de sauvegarde non prise en charge.');
    const settings = record(input.settings, 'les réglages');
    const clean = blankState();
    clean.settings.limit = number(settings.limit, 1, 20000, 'le plafond quotidien');
    clean.settings.height = settings.height === null ? null : number(settings.height, 20, 300, 'la taille');
    clean.settings.username = settings.username === undefined ? '' : text(settings.username, 'le nom d’utilisateur', 40, true);
    clean.settings.avatar = settings.avatar === undefined ? '🍎' : text(settings.avatar, 'l’avatar', 32, false);
    const sex = settings.sex === undefined ? '' : settings.sex;
    if (!['', 'female', 'male', 'other'].includes(sex)) invalid('le sexe');
    clean.settings.sex = sex;
    clean.settings.age = settings.age === undefined || settings.age === null ? null : integer(settings.age, 1, 120, 'l’âge');
    // Legacy step settings remain in saved data and backups, without affecting budgets.
    clean.settings.stepsBaseline = settings.stepsBaseline === undefined || settings.stepsBaseline === null ? null : integer(settings.stepsBaseline, 0, 100000, 'le seuil de pas habituel');
    const favorites = settings.favoriteIds === undefined ? [] : list(settings.favoriteIds, MAX_FOODS, 'les favoris');
    const favoriteIds = new Set();
    clean.settings.favoriteIds = favorites.map(value => {
      const favoriteId = id(value, 'un identifiant de favori');
      if (favoriteIds.has(favoriteId)) invalid('un favori apparaît plusieurs fois.');
      favoriteIds.add(favoriteId);
      return favoriteId;
    });

    const days = record(input.days, 'les journées');
    const dates = Object.keys(days);
    if (dates.length > MAX_DAYS) invalid('trop de journées.');
    const entryIds = new Set();
    for (const date of dates.sort()) {
      dateValue(date, 'la date de consommation');
      const day = record(days[date], 'une journée');
      const cleanDay = {
        limit: number(day.limit, 1, 20000, 'le plafond de la journée'),
        entries: []
      };
      cleanDay.entries = list(day.entries, MAX_ENTRIES_PER_DAY, 'les consommations de la journée').map(value => {
        const entry = record(value, 'une consommation');
        const entryId = id(entry.id, 'un identifiant de consommation');
        if (entryIds.has(entryId)) invalid('un identifiant de consommation apparaît plusieurs fois.');
        entryIds.add(entryId);
        const cleanEntry = {
          id: entryId,
          name: text(entry.name, 'le nom de la consommation', 120, false),
          portion: text(entry.portion, 'la portion', 160, true),
          kcal: number(entry.kcal, 0, 100000, 'les calories de la consommation'),
          createdAt: timestamp(entry.createdAt, 'la date de création de la consommation', false)
        };
        if (entry.foodId !== undefined) cleanEntry.foodId = id(entry.foodId, 'un identifiant d’aliment');
        if (hasQuantityMetadata(entry)) {
          const details = entryQuantity(entry);
          const total = quantityCalories(details.unitKcal, details.quantity);
          if (roundCalories(cleanEntry.kcal) !== total) invalid('les calories ne correspondent pas à la quantité.');
          cleanEntry.kcal = total;
          cleanEntry.quantity = details.quantity;
          cleanEntry.unitKcal = details.unitKcal;
          cleanEntry.quantityUnit = details.quantityUnit;
        }
        return cleanEntry;
      });
      if (Object.prototype.hasOwnProperty.call(day, 'activity')) cleanDay.activity = validateActivity(day.activity);
      clean.days[date] = cleanDay;
    }

    const foodIds = new Set();
    clean.foods = list(input.foods, MAX_FOODS, 'les aliments personnels').map(value => {
      const food = record(value, 'un aliment');
      const foodId = id(food.id, 'un identifiant d’aliment');
      if (foodIds.has(foodId)) invalid('un identifiant d’aliment apparaît plusieurs fois.');
      foodIds.add(foodId);
      if (!['100g', '100ml', 'portion'].includes(food.basis)) invalid('l’unité d’un aliment');
      const cleanFood = {
        id: foodId,
        name: text(food.name, 'le nom de l’aliment', 120, false),
        kcal: number(food.kcal, 0, 100000, 'les calories de l’aliment'),
        basis: food.basis,
        portionName: text(food.portionName, 'le nom de la portion', 80, food.basis !== 'portion'),
        defaultAmount: number(food.defaultAmount, 0, 100000, 'la quantité habituelle', true),
        emoji: text(food.emoji, 'l’icône de l’aliment', 32, true)
      };
      if (food.source !== undefined) cleanFood.source = sourceValue(food.source);
      return cleanFood;
    });

    const weightDates = new Set();
    clean.weights = list(input.weights, MAX_WEIGHTS, 'les pesées').map(value => {
      const weight = record(value, 'une pesée');
      const date = dateValue(weight.date, 'la date de pesée');
      if (weightDates.has(date)) invalid('plusieurs pesées ont la même date.');
      weightDates.add(date);
      return { date, kg: number(weight.kg, 1, 1000, 'le poids') };
    }).sort((a, b) => a.date.localeCompare(b.date));
    clean.updatedAt = timestamp(input.updatedAt, 'la dernière modification', true);
    clean.lastBackupAt = timestamp(input.lastBackupAt, 'la dernière sauvegarde', true);
    return clean;
  }

  function makeBackup(state) {
    return { app: 'pomme', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: validateState(state) };
  }

  // JSON.parse keeps only the last repeated object key. Reject such files before
  // importing so duplicate day keys cannot silently discard a day's entries.
  // Input syntax is already checked by JSON.parse; this scan is iterative.
  function rejectDuplicateJSONKeys(value) {
    const stack = [];
    for (let offset = 0; offset < value.length; offset += 1) {
      const character = value[offset];
      if (character === '"') {
        const start = offset;
        offset += 1;
        while (offset < value.length) {
          if (value[offset] === '\\') offset += 2;
          else if (value[offset] === '"') break;
          else offset += 1;
        }
        const context = stack[stack.length - 1];
        if (context && context.object && context.expectKey) {
          const key = JSON.parse(value.slice(start, offset + 1));
          if (context.keys.has(key)) invalid('le fichier contient une propriété en double.');
          context.keys.add(key);
          context.expectKey = false;
        }
      } else if (character === '{' || character === '[') {
        if (stack.length >= 64) invalid('le fichier contient trop de niveaux imbriqués.');
        stack.push(character === '{' ? { object: true, keys: new Set(), expectKey: true } : { object: false });
      } else if (character === '}' || character === ']') stack.pop();
      else if (character === ',') {
        const context = stack[stack.length - 1];
        if (context && context.object) context.expectKey = true;
      }
    }
  }

  function parseBackup(value) {
    if (typeof value !== 'string') invalid('le fichier doit contenir du texte JSON.');
    // Length check first avoids allocating an encoded copy of arbitrarily large input.
    if (value.length > MAX_BACKUP_BYTES || new TextEncoder().encode(value).byteLength > MAX_BACKUP_BYTES) {
      invalid('le fichier dépasse la taille maximale de 5 Mo.');
    }
    let envelope;
    try { envelope = JSON.parse(value); }
    catch (_) { invalid('le fichier JSON est illisible.'); }
    rejectDuplicateJSONKeys(value);
    record(envelope, 'le fichier de sauvegarde');
    if (envelope.app !== 'pomme' || ![1, 2, SCHEMA_VERSION].includes(envelope.version)) invalid('ce fichier n’est pas une sauvegarde Pomme compatible.');
    timestamp(envelope.exportedAt, 'la date d’export', false);
    return validateState(envelope.data);
  }

  function getDay(state, date) {
    dateValue(date, 'la journée');
    return state.days[date] || { limit: state.settings.limit, entries: [] };
  }

  function roundCalories(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

  function quantityCalories(unitKcal, quantity) {
    const calories = decimal(unitKcal);
    const amount = decimal(quantity);
    number(calories, 0, 100000, 'les calories par unité');
    number(amount, 0, 100000, 'la quantité', true);
    const result = roundCalories(calories * amount);
    number(result, 0, 100000, 'les calories de la consommation');
    return result;
  }

  // Reading an old entry does not turn it into a new-schema entry in storage.
  function entryQuantity(entry) {
    record(entry, 'une consommation');
    if (!hasQuantityMetadata(entry)) {
      return { quantity: 1, unitKcal: number(entry.kcal, 0, 100000, 'les calories de la consommation'), quantityUnit: 'portion' };
    }
    const quantity = number(entry.quantity, 0, 100000, 'la quantité', true);
    const unitKcal = number(entry.unitKcal, 0, 100000, 'les calories par unité');
    const quantityUnit = text(entry.quantityUnit, 'l’unité de quantité', 80, false);
    quantityCalories(unitKcal, quantity);
    return { quantity, unitKcal, quantityUnit };
  }

  function dayTotal(day) {
    return roundCalories(day.entries.reduce((sum, entry) => sum + entry.kcal, 0));
  }

  function latestWeight(state) {
    return state.weights.reduce((latest, weight) => !latest || weight.date > latest.date ? weight : latest, null);
  }

  function weightAtDate(state, date) {
    dateValue(date, 'la date de référence du poids');
    return state.weights.reduce((latest, weight) => weight.date <= date && (!latest || weight.date > latest.date) ? weight : latest, null);
  }

  function estimateStepBonus(steps, baseline, weightKg) {
    integer(steps, 0, 100000, 'les pas quotidiens');
    integer(baseline, 0, 100000, 'le seuil de pas');
    number(weightKg, 1, 1000, 'le poids utilisé pour les pas');
    return Math.round(weightKg * Math.max(0, steps - baseline) / 3000);
  }

  function validateActivity(value) {
    const activity = record(value, 'les pas de la journée');
    const steps = integer(activity.steps, 0, 100000, 'les pas quotidiens');
    const baseline = activity.baseline === null ? null : integer(activity.baseline, 0, 100000, 'le seuil de pas');
    if (typeof activity.enabled !== 'boolean') invalid('la prise en compte des pas');
    const weightKg = activity.weightKg === null ? null : number(activity.weightKg, 1, 1000, 'le poids utilisé pour les pas');
    if (activity.enabled && (baseline === null || weightKg === null)) invalid('un seuil de pas et une pesée sont nécessaires pour ajuster le plafond.');
    const bonusKcal = integer(activity.bonusKcal, 0, 33333, 'le bonus de calories');
    const expected = activity.enabled ? estimateStepBonus(steps, baseline, weightKg) : 0;
    if (bonusKcal !== expected) invalid('le bonus de calories ne correspond pas aux pas enregistrés.');
    return { steps, baseline, enabled: activity.enabled, weightKg, bonusKcal };
  }

  // Legacy compatibility only: the step interface has been removed. Keep these
  // recorded inputs together for old backups; dayBudget never applies the bonus.
  function setDayActivity(state, date, options) {
    dateValue(date, 'la date des pas');
    if (date > localDate()) invalid('les pas ne peuvent pas être saisis à une date future.');
    record(options, 'les réglages des pas');
    const steps = integer(options.steps, 0, 100000, 'les pas quotidiens');
    const baseline = options.baseline === null ? null : integer(options.baseline, 0, 100000, 'le seuil de pas');
    if (typeof options.enabled !== 'boolean') invalid('la prise en compte des pas');
    const weight = weightAtDate(state, date);
    const weightKg = weight ? number(weight.kg, 1, 1000, 'le poids utilisé pour les pas') : null;
    if (options.enabled && (baseline === null || weightKg === null)) invalid('un seuil de pas et une pesée à cette date ou avant sont nécessaires pour ajuster le plafond.');
    const activity = validateActivity({
      steps, baseline, enabled: options.enabled, weightKg,
      bonusKcal: options.enabled ? estimateStepBonus(steps, baseline, weightKg) : 0
    });
    const day = state.days[date] || { limit: number(state.settings.limit, 1, 20000, 'le plafond quotidien'), entries: [] };
    day.activity = activity;
    state.days[date] = day;
    return activity;
  }

  function dayBudget(day) {
    const base = number(day.limit, 1, 20000, 'le plafond de la journée');
    return { base, bonus: 0, total: base };
  }

  function portionCalories(food, amount) {
    number(food.kcal, 0, 100000, 'les calories de l’aliment');
    if (!['100g', '100ml', 'portion'].includes(food.basis)) invalid('l’unité de l’aliment');
    return quantityCalories(food.kcal / (food.basis === 'portion' ? 1 : 100), amount);
  }

  function storageError(error, fallback) {
    const message = error && error.message ? error.message : fallback;
    const result = new Error(message || 'Impossible d’accéder au stockage de cet appareil.');
    if (error && error.name) result.name = error.name;
    return result;
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) {
        reject(new Error('Le stockage local est indisponible dans ce navigateur.'));
        return;
      }
      let request;
      let settled = false;
      try { request = root.indexedDB.open(DB_NAME, 1); }
      catch (error) { reject(storageError(error)); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onerror = () => {
        settled = true;
        reject(storageError(request.error, 'Impossible d’ouvrir la base locale.'));
      };
      request.onblocked = () => {
        settled = true;
        reject(new Error('Fermez les autres onglets Pomme, puis rechargez cette page.'));
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) { db.close(); return; }
        settled = true;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }

  function readDB(db) {
    return new Promise((resolve, reject) => {
      let transaction;
      let request;
      let result;
      try {
        transaction = db.transaction(STORE_NAME, 'readonly');
        request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      } catch (error) { reject(storageError(error)); return; }
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(storageError(request.error, 'Lecture locale impossible.'));
      transaction.onabort = () => reject(storageError(transaction.error || request.error, 'Lecture locale interrompue.'));
      transaction.onerror = () => reject(storageError(transaction.error || request.error, 'Lecture locale impossible.'));
      transaction.oncomplete = () => {
        try { resolve(result === undefined ? null : validateState(result)); }
        catch (error) { reject(error); }
      };
    });
  }

  async function writeDB(db, state) {
    const snapshot = validateState(state);
    return new Promise((resolve, reject) => {
      let transaction;
      let request;
      try {
        transaction = db.transaction(STORE_NAME, 'readwrite');
        request = transaction.objectStore(STORE_NAME).put(snapshot, STATE_KEY);
      } catch (error) { reject(storageError(error)); return; }
      request.onerror = () => reject(storageError(request.error, 'Enregistrement local impossible.'));
      transaction.onabort = () => reject(storageError(transaction.error || request.error, 'Enregistrement interrompu.'));
      transaction.onerror = () => reject(storageError(transaction.error || request.error, 'Enregistrement local impossible.'));
      // A successful put request alone does not prove that the transaction committed.
      transaction.oncomplete = () => resolve(snapshot);
    });
  }

  // One readwrite transaction serializes changes across all tabs of this origin.
  // Mutators must not await: IndexedDB would otherwise close the transaction.
  function updateDB(db, mutator) {
    return new Promise((resolve, reject) => {
      if (typeof mutator !== 'function') { reject(new TypeError('Modification incorrecte.')); return; }
      let transaction;
      let request;
      let snapshot;
      let mutationError;
      try {
        transaction = db.transaction(STORE_NAME, 'readwrite');
        request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      } catch (error) { reject(storageError(error)); return; }
      request.onerror = () => reject(storageError(request.error, 'Lecture locale impossible.'));
      transaction.onabort = () => reject(mutationError || storageError(transaction.error || request.error, 'Modification locale interrompue.'));
      transaction.onerror = () => reject(mutationError || storageError(transaction.error || request.error, 'Modification locale impossible.'));
      request.onsuccess = () => {
        try {
          const draft = request.result === undefined ? blankState() : validateState(request.result);
          const result = mutator(draft);
          if (result && typeof result.then === 'function') throw new TypeError('La modification doit être synchrone.');
          snapshot = validateState(result === undefined ? draft : result);
          const writeRequest = transaction.objectStore(STORE_NAME).put(snapshot, STATE_KEY);
          writeRequest.onerror = () => reject(storageError(writeRequest.error, 'Enregistrement local impossible.'));
        } catch (error) {
          mutationError = error;
          try { transaction.abort(); } catch (_) { /* The transaction may already be aborted. */ }
          reject(error);
        }
      };
      transaction.oncomplete = () => {
        if (snapshot) resolve(snapshot);
        else reject(new Error('La modification n’a pas été enregistrée.'));
      };
    });
  }

  root.PommeCore = Object.freeze({
    DB_NAME, SCHEMA_VERSION, MAX_BACKUP_BYTES, MAX_FAVORITES, localDate, validDate, decimal, blankState, validateState,
    makeBackup, parseBackup, getDay, dayTotal, latestWeight, weightAtDate, portionCalories,
    estimateStepBonus, setDayActivity, dayBudget,
    setFavorite, quantityCalories, entryQuantity,
    openDB, readDB, writeDB, updateDB
  });
})(globalThis);
