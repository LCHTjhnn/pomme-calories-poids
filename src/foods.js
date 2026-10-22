/*
 * Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.
 * Source officielle : édition anglaise datée du 03/11/2025, consultée le 22/10/2026.
 * Valeurs de la colonne « Energy, Regulation EU No 1169 2011 (kcal 100g) ».
 * Toutes les valeurs portent sur 100 g de partie comestible, y compris le lait
 * et l'huile. Aucune conversion grammes/millilitres n'a été supposée.
 * Les libellés français sont des traductions descriptives des entrées identifiées.
 * Réutilisation : Licence Ouverte / Open Licence, Etalab 2.0.
 */
(function () {
  'use strict';
  const datasetUrl = 'https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202025_ENG_2025_11_03.xlsx';
  const rows = [
    ['13039', 'Pomme, chair et peau, crue', 54, '🍎'],
    ['13005', 'Banane, chair sans peau, crue', 87.6, '🍌'],
    ['7110', 'Pain complet ou intégral (farine T150)', 234, '🍞'],
    ['9104', 'Riz blanc, cuit, sans sel ajouté', 155, '🍚'],
    ['9811', 'Pâtes classiques, cuites, sans sel ajouté', 167, '🍝'],
    ['22010', 'Œuf dur, sans coquille', 134, '🥚'],
    ['36018', 'Poulet, blanc sans peau, grillé ou poêlé', 141, '🍗'],
    ['19041', 'Lait demi-écrémé UHT', 47.7, '🥛'],
    ['19593', 'Yaourt ou lait fermenté, nature', 50.1, '🥣'],
    ['17270', 'Huile d’olive vierge extra', 899, '🫒'],
    ['20009', 'Carotte, crue', 30.2, '🥕'],
    ['20385', 'Tomate, crue', 19.2, '🍅'],
    ['4003', 'Pomme de terre, cuite à l’eau', 81, '🥔'],
    ['20360', 'Lentilles, cuites à l’eau', 125, '🫘'],
    ['15000', 'Amandes avec peau, sans sel ajouté', 615, '🌰'],
    ['25996', 'Saumon, cuit (moyenne)', 205, '🐟'],
    ['12115', 'Emmental au lait de vache', 373, '🧀'],
    ['32140', 'Flocons d’avoine, secs', 369, '🌾'],
    ['16400', 'Beurre doux, au moins 80 % de matière grasse', 753, '🧈']
  ];
  globalThis.PommeFoods = {
    foods: rows.map(([code, name, kcal, emoji]) => ({
      id: 'ciqual-' + code,
      name,
      kcal,
      basis: '100g',
      portionName: 'g',
      defaultAmount: 100,
      emoji,
      source: {
        label: 'ANSES · Ciqual 2025 · aliment ' + code,
        url: datasetUrl
      }
    })),
    sources: [{
      label: 'Anses. 2025. Table de composition nutritionnelle des aliments Ciqual',
      url: datasetUrl,
      website: 'https://ciqual.anses.fr/',
      documentation: 'https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202025%20doc%20FR_2025_11_19.pdf',
      license: 'Licence Ouverte / Open Licence Etalab 2.0',
      consultedOn: '2026-10-22',
      note: 'Valeurs moyennes pour 100 g de partie comestible. Peser l’aliment dans l’état indiqué (cru ou cuit). Le lait et l’huile sont aussi exprimés en grammes. Pour un produit précis, utiliser les informations de son emballage.'
    }]
  };
}());
