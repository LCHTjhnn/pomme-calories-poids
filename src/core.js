(function (root) {
  'use strict';

  const DB_NAME = 'pomme-local-v1';
  const STORE_NAME = 'state';
  const STATE_KEY = 'singleton';
  const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
  const MAX_DAYS = 20000;
  const MAX_WEIGHTS = 20000;
  const MAX_FOODS = 2000;
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
      schemaVersion: 1,
      settings: { limit: 2000, height: null, favoriteIds: [] },
      days: {},
      foods: [],
      weights: [],
      updatedAt: null,
      lastBackupAt: null
    };
  }

  // Rebuild the complete persisted schema; no spread/merge of imported objects.
  function validateState(input) {
    record(input, 'la sauvegarde');
    if (input.schemaVersion !== 1) invalid('version de sauvegarde non prise en charge.');
    const settings = record(input.settings, 'les réglages');
    const clean = blankState();
    clean.settings.limit = number(settings.limit, 1, 20000, 'le plafond quotidien');
    clean.settings.height = settings.height === null ? null : number(settings.height, 20, 300, 'la taille');
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
        return cleanEntry;
      });
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
    return { app: 'pomme', version: 1, exportedAt: new Date().toISOString(), data: validateState(state) };
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
    if (envelope.app !== 'pomme' || envelope.version !== 1) invalid('ce fichier n’est pas une sauvegarde Pomme compatible.');
    timestamp(envelope.exportedAt, 'la date d’export', false);
    return validateState(envelope.data);
  }

  function getDay(state, date) {
    dateValue(date, 'la journée');
    return state.days[date] || { limit: state.settings.limit, entries: [] };
  }

  function roundCalories(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }

  function dayTotal(day) {
    return roundCalories(day.entries.reduce((sum, entry) => sum + entry.kcal, 0));
  }

  function latestWeight(state) {
    return state.weights.reduce((latest, weight) => !latest || weight.date > latest.date ? weight : latest, null);
  }

  function portionCalories(food, amount) {
    const quantity = decimal(amount);
    number(quantity, 0, 100000, 'la quantité', true);
    number(food.kcal, 0, 100000, 'les calories de l’aliment');
    if (!['100g', '100ml', 'portion'].includes(food.basis)) invalid('l’unité de l’aliment');
    const result = roundCalories(food.kcal * quantity / (food.basis === 'portion' ? 1 : 100));
    number(result, 0, 100000, 'les calories de la portion');
    return result;
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
    DB_NAME, MAX_BACKUP_BYTES, localDate, validDate, decimal, blankState, validateState,
    makeBackup, parseBackup, getDay, dayTotal, latestWeight, portionCalories,
    openDB, readDB, writeDB, updateDB
  });
})(globalThis);
