(function (root) {
  'use strict';

  const C = root.PommeCore;
  if (!C) throw new Error('PommeCore doit être chargé avant l’historique.');
  const MIN_MONTH = '1900-01';
  const MAX_MONTH = '9999-12';

  function dateValue(value) {
    if (!C.validDate(value)) throw new TypeError('Date incorrecte pour l’historique.');
    return value;
  }

  function monthValue(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value) ||
        value < MIN_MONTH || value > MAX_MONTH || !C.validDate(value + '-01')) {
      throw new TypeError('Mois incorrect pour l’historique.');
    }
    return value;
  }

  function leapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function monthLength(year, month) {
    return [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }

  function round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function daySummary(state, date, today) {
    dateValue(date);
    dateValue(today);
    if (!state || !state.settings || !state.days || typeof state.days !== 'object' || Array.isArray(state.days)) {
      throw new TypeError('Carnet incorrect pour l’historique.');
    }
    // Reading the fallback must not create a stored day, even when it is selected.
    const day = C.getDay(state, date);
    if (!Array.isArray(day.entries) || day.entries.some(entry => !entry ||
        typeof entry.kcal !== 'number' || !Number.isFinite(entry.kcal) || entry.kcal < 0)) {
      throw new TypeError('Consommations incorrectes pour l’historique.');
    }
    const count = day.entries.length;
    const hasEntries = count > 0;
    const total = C.dayTotal(day);
    const limit = C.dayBudget(day).total;
    const over = total > limit;
    const status = date > today ? 'future' : date === today ? 'current' :
      !hasEntries ? 'missing' : over ? 'over' : 'ok';
    return {
      date, status, hasEntries, count, total, limit, over,
      remaining: round(limit - total),
      percent: Math.max(0, Math.min(100, total / limit * 100))
    };
  }

  function monthCells(state, month, today) {
    monthValue(month);
    dateValue(today);
    const [year, number] = month.split('-').map(Number);
    // Gregorian arithmetic keeps the weekday independent of timezone and DST.
    const previousYear = year - 1;
    let elapsedDays = previousYear * 365 + Math.floor(previousYear / 4) -
      Math.floor(previousYear / 100) + Math.floor(previousYear / 400);
    for (let preceding = 1; preceding < number; preceding += 1) {
      elapsedDays += monthLength(year, preceding);
    }
    const days = Array.from({ length: monthLength(year, number) }, (_, index) =>
      daySummary(state, month + '-' + String(index + 1).padStart(2, '0'), today));
    return { offset: elapsedDays % 7, days };
  }

  function shiftMonth(month, delta) {
    monthValue(month);
    if (!Number.isSafeInteger(delta)) throw new TypeError('Décalage de mois incorrect.');
    const [year, number] = month.split('-').map(Number);
    const index = year * 12 + number - 1 + delta;
    if (index < 1900 * 12 || index > 9999 * 12 + 11) return null;
    return String(Math.floor(index / 12)).padStart(4, '0') + '-' + String(index % 12 + 1).padStart(2, '0');
  }

  function selectMonthDate(date, month, today) {
    dateValue(date);
    monthValue(month);
    dateValue(today);
    const [year, number] = month.split('-').map(Number);
    const day = Math.min(Number(date.slice(8)), monthLength(year, number));
    const selected = month + '-' + String(day).padStart(2, '0');
    return selected > today ? today : selected;
  }

  root.PommeHistory = Object.freeze({ daySummary, monthCells, shiftMonth, selectMonthDate });
})(globalThis);
