import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/food-icons.js';

const F = globalThis.PommeFoodIcons;
const original = [
  ['🍽️','Assiette'],['☕','Café'],['🥛','Lait'],['🍵','Thé'],['🥤','Boisson'],['💧','Eau'],
  ['🍎','Pomme'],['🍌','Banane'],['🍊','Orange'],['🍓','Fraise'],['🍞','Pain'],['🥐','Croissant'],
  ['🥣','Bol'],['🥚','Œuf'],['🧀','Fromage'],['🥩','Viande'],['🍗','Poulet'],['🐟','Poisson'],
  ['🍚','Riz'],['🍝','Pâtes'],['🥗','Salade'],['🥕','Carotte'],['🍫','Chocolat'],['🍪','Biscuit'],
  ['🧃','Jus de fruits'],['🍹','Cocktail'],['🍷','Vin'],['🍺','Bière'],['🍐','Poire'],['🍑','Pêche'],
  ['🍒','Cerises'],['🍇','Raisin'],['🍉','Pastèque'],['🍍','Ananas'],['🥝','Kiwi'],['🍋','Citron'],
  ['🥑','Avocat'],['🍅','Tomate'],['🥦','Brocoli'],['🥒','Concombre'],['🌽','Maïs'],['🥔','Pomme de terre'],
  ['🍄','Champignon'],['🥖','Baguette'],['🥯','Bagel'],['🥨','Bretzel'],['🥞','Pancakes'],['🧇','Gaufre'],
  ['🍳','Œuf au plat'],['🥓','Bacon'],['🍤','Crevette panée'],['🍕','Pizza'],['🍔','Hamburger'],['🥪','Sandwich'],
  ['🌮','Taco'],['🍣','Sushi'],['🍰','Gâteau'],['🍦','Glace'],['🍯','Miel'],['🥜','Arachides']
];
const requested = '🫐 🫒 🥥 🍈 🍋‍🟩 🫚 🫛 🧄 🧅 🫑 🥬 🍠 🫕 🥘 🍲 🥣 🍛 🍜 🍝 🍣 🍱 🍙 🍚 🍘 🍥 🥟 🥠 🥡 🍢 🍡 🦪 🍬 🍭 🍮 🧁 🎂 🍧 🍨 🥧 🫖 🍵 🧋 🍶 🍾 🥂 🍸 🧊 🫘 🌰 🧈 🌭 🫓 🥯 🥫 🦀 🦞 🦑 🐙'.split(' ');

test('all 60 original icons retain their exact order, stored value, identifier and French label', () => {
  assert.equal(original.length, 60);
  assert.deepEqual(F.choices.slice(0, 60), original.map(([emoji, label]) => ({ id: emoji, emoji, label })));
});

test('all 58 requested icons occur once, six already existed, and 52 additions give 112 total', () => {
  assert.equal(requested.length, 58);
  const originalKeys = new Set(original.map(([emoji]) => F.normalizeEmoji(emoji)));
  const duplicates = requested.filter(emoji => originalKeys.has(F.normalizeEmoji(emoji)));
  assert.deepEqual(duplicates, ['🥣', '🍝', '🍣', '🍚', '🍵', '🥯']);
  assert.equal(requested.length - duplicates.length, 52);
  assert.equal(F.choices.length, 112);
  assert.equal(new Set(F.choices.map(choice => F.normalizeEmoji(choice.emoji))).size, 112);
  for (const emoji of requested) {
    assert.equal(F.choices.filter(choice => F.normalizeEmoji(choice.emoji) === F.normalizeEmoji(emoji)).length, 1, emoji);
  }
});

test('new icons have unique stable descriptive identifiers and French labels', () => {
  assert.equal(new Set(F.choices.map(choice => choice.id)).size, F.choices.length);
  const additions = F.choices.slice(60);
  for (const choice of additions) {
    assert.match(choice.id, /^food-[a-z]+(?:-[a-z]+)*$/);
    assert.ok(choice.label.trim().length > 1);
    assert.equal(F.choicesFor(choice.emoji).find(item => item.emoji === choice.emoji).id, choice.id);
  }
  assert.deepEqual(additions.map(choice => choice.id), [
    'food-myrtilles','food-olive','food-noix-de-coco','food-melon','food-citron-vert','food-gingembre',
    'food-petits-pois','food-ail','food-oignon','food-poivron','food-legume-feuillu','food-patate-douce',
    'food-fondue','food-paella','food-mijote','food-curry','food-nouilles','food-bento','food-onigiri',
    'food-galette-de-riz','food-gateau-de-poisson','food-ravioli','food-biscuit-fortune','food-plat-a-emporter',
    'food-brochette-oden','food-dango','food-huitre','food-bonbon','food-sucette','food-flan','food-cupcake',
    'food-gateau-anniversaire','food-glace-pilee','food-coupe-glacee','food-tarte','food-theiere',
    'food-the-aux-perles','food-sake','food-champagne','food-coupes-champagne','food-martini','food-glacon',
    'food-haricots','food-chataigne','food-beurre','food-hot-dog','food-pain-plat','food-conserve',
    'food-crabe','food-homard','food-calamar','food-poulpe'
  ]);
  assert.equal(additions.find(choice => choice.id === 'food-citron-vert').label, 'Citron vert');
  assert.equal(additions.find(choice => choice.id === 'food-huitre').label, 'Huître');
});

test('normalization combines Unicode accents and ignores text or emoji presentation selectors', () => {
  assert.equal(F.normalizeEmoji('e\u0301'), 'é');
  for (const variant of ['🍽', '🍽\uFE0F', '🍽\uFE0E']) assert.equal(F.normalizeEmoji(variant), '🍽');
  assert.equal(F.normalizeEmoji('☕\uFE0F'), F.normalizeEmoji('☕\uFE0E'));
  assert.throws(() => F.normalizeEmoji(null), TypeError);
});

test('editing a stored presentation variant keeps its exact value without adding a duplicate', () => {
  for (const selected of ['🍽', '🍽\uFE0F', '🍽\uFE0E', '☕\uFE0E', '🫐\uFE0F']) {
    const result = F.choicesFor(selected);
    const matches = result.filter(choice => F.normalizeEmoji(choice.emoji) === F.normalizeEmoji(selected));
    assert.equal(result.length, 112);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].emoji, selected);
    const originalChoice = F.choices.find(choice => F.normalizeEmoji(choice.emoji) === F.normalizeEmoji(selected));
    assert.equal(matches[0].id, originalChoice.id);
    assert.equal(matches[0].label, originalChoice.label);
    assert.notEqual(matches[0], originalChoice);
  }
});

test('the green lime ZWJ sequence remains distinct from lemon and keeps recent emoji intact', () => {
  const lime = '🍋‍🟩';
  assert.deepEqual(Array.from(F.normalizeEmoji(lime), character => character.codePointAt(0)), [0x1f34b, 0x200d, 0x1f7e9]);
  assert.notEqual(F.normalizeEmoji(lime), F.normalizeEmoji('🍋'));
  const variant = '🍋\uFE0F\u200D🟩';
  assert.equal(F.normalizeEmoji(variant), lime);
  const choice = F.choicesFor(variant).find(item => item.id === 'food-citron-vert');
  assert.equal(choice.emoji, variant);
  assert.equal(choice.label, 'Citron vert');
  for (const emoji of ['🫚', '🫛', '🫘']) assert.ok(F.choices.some(item => item.emoji === emoji));
});

test('icons outside the catalog stay selectable with a stable codepoint identifier', () => {
  for (const selected of ['🧑‍🍳', '🧑\uFE0F‍🍳']) {
    const result = F.choicesFor(selected);
    assert.equal(result.length, 113);
    assert.deepEqual(result.at(-1), { id: 'custom-1f9d1-200d-1f373', emoji: selected, label: 'Icône actuelle' });
    assert.equal(new Set(result.map(choice => F.normalizeEmoji(choice.emoji))).size, 113);
  }
  assert.equal(F.choicesFor('e\u0301').at(-1).id, F.choicesFor('é').at(-1).id);
});

test('picker preparation and returned list changes cannot mutate the shared catalog', () => {
  const before = JSON.stringify(F.choices);
  assert.ok(Object.isFrozen(F.choices));
  assert.ok(F.choices.every(Object.isFrozen));
  const first = F.choicesFor('🍽');
  first[0].emoji = '🧑‍🍳';
  first[1].label = 'Étiquette locale';
  first.splice(2, 10);
  const second = F.choicesFor('🫐');
  second.reverse();
  F.choicesFor('🧑‍🍳');
  assert.equal(JSON.stringify(F.choices), before);
  assert.deepEqual(F.choicesFor('🍽️')[0], { id: '🍽️', emoji: '🍽️', label: 'Assiette' });
});
