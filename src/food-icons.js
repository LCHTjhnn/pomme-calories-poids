(function (root) {
  'use strict';

  // These emoji values are the original identifiers stored in existing notebooks.
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

  // Stable identifiers do not depend on the array order or translated labels.
  const additions = [
    ['food-myrtilles','🫐','Myrtilles'],
    ['food-olive','🫒','Olive'],
    ['food-noix-de-coco','🥥','Noix de coco'],
    ['food-melon','🍈','Melon'],
    ['food-citron-vert','🍋‍🟩','Citron vert'],
    ['food-gingembre','🫚','Gingembre'],
    ['food-petits-pois','🫛','Petits pois'],
    ['food-ail','🧄','Ail'],
    ['food-oignon','🧅','Oignon'],
    ['food-poivron','🫑','Poivron'],
    ['food-legume-feuillu','🥬','Légume feuillu'],
    ['food-patate-douce','🍠','Patate douce'],
    ['food-fondue','🫕','Fondue'],
    ['food-paella','🥘','Paella'],
    ['food-mijote','🍲','Plat mijoté'],
    ['food-bol','🥣','Bol'],
    ['food-curry','🍛','Riz au curry'],
    ['food-nouilles','🍜','Soupe de nouilles'],
    ['food-pates','🍝','Pâtes'],
    ['food-sushi','🍣','Sushi'],
    ['food-bento','🍱','Bento'],
    ['food-onigiri','🍙','Boulette de riz'],
    ['food-riz','🍚','Riz'],
    ['food-galette-de-riz','🍘','Galette de riz'],
    ['food-gateau-de-poisson','🍥','Gâteau de poisson'],
    ['food-ravioli','🥟','Ravioli'],
    ['food-biscuit-fortune','🥠','Biscuit de fortune'],
    ['food-plat-a-emporter','🥡','Plat à emporter'],
    ['food-brochette-oden','🍢','Brochette oden'],
    ['food-dango','🍡','Brochette de dango'],
    ['food-huitre','🦪','Huître'],
    ['food-bonbon','🍬','Bonbon'],
    ['food-sucette','🍭','Sucette'],
    ['food-flan','🍮','Flan'],
    ['food-cupcake','🧁','Cupcake'],
    ['food-gateau-anniversaire','🎂','Gâteau d’anniversaire'],
    ['food-glace-pilee','🍧','Glace pilée'],
    ['food-coupe-glacee','🍨','Coupe glacée'],
    ['food-tarte','🥧','Tarte'],
    ['food-theiere','🫖','Théière'],
    ['food-the','🍵','Thé'],
    ['food-the-aux-perles','🧋','Thé aux perles'],
    ['food-sake','🍶','Saké'],
    ['food-champagne','🍾','Bouteille de champagne'],
    ['food-coupes-champagne','🥂','Coupes de champagne'],
    ['food-martini','🍸','Cocktail martini'],
    ['food-glacon','🧊','Glaçon'],
    ['food-haricots','🫘','Haricots'],
    ['food-chataigne','🌰','Châtaigne'],
    ['food-beurre','🧈','Beurre'],
    ['food-hot-dog','🌭','Hot-dog'],
    ['food-pain-plat','🫓','Pain plat'],
    ['food-bagel','🥯','Bagel'],
    ['food-conserve','🥫','Conserve'],
    ['food-crabe','🦀','Crabe'],
    ['food-homard','🦞','Homard'],
    ['food-calamar','🦑','Calamar'],
    ['food-poulpe','🐙','Poulpe']
  ];

  function normalizeEmoji(emoji) {
    if (typeof emoji !== 'string') throw new TypeError('Icône incorrecte.');
    // Presentation selectors are equivalent; keep ZWJ sequences such as lime intact.
    return emoji.normalize('NFC').replace(/[\uFE0E\uFE0F]/g, '');
  }

  const seen = new Set();
  const choices = Object.freeze([
    ...original.map(([emoji, label]) => ({ id: emoji, emoji, label })),
    ...additions.map(([id, emoji, label]) => ({ id, emoji, label }))
  ].filter(choice => {
    const key = normalizeEmoji(choice.emoji);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(choice => Object.freeze(choice)));

  function choicesFor(selected) {
    const key = normalizeEmoji(selected);
    let matched = false;
    const result = choices.map(choice => {
      if (normalizeEmoji(choice.emoji) === key) {
        matched = true;
        // Editing another field must not rewrite an already stored emoji variant.
        return { ...choice, emoji: selected };
      }
      return { ...choice };
    });
    if (!matched) result.push({
      id: 'custom-' + Array.from(key, character => character.codePointAt(0).toString(16)).join('-'),
      emoji: selected,
      label: 'Icône actuelle'
    });
    return result;
  }

  root.PommeFoodIcons = Object.freeze({ choices, normalizeEmoji, choicesFor });
})(globalThis);
