# Pomme — calories et poids

Une petite application en français, adaptée à Safari sur iPhone : journal quotidien des calories, plafond réglable, aliments et favoris, saisie au pavé numérique, pesées datées et graphique d’évolution. Aucune consommation ni pesée de démonstration n’est enregistrée.

## Lien de l’application

Version en ligne : https://pomme-calories-poids.brownpin256.chatgpt.site/

L’hébergement est inchangé et géré en dehors de GitHub. Ce dépôt privé sert uniquement à conserver le code source : aucune publication GitHub Pages ni déploiement automatique n’y est configuré.

## Construire et vérifier

Depuis ce dossier, avec Node.js :

```sh
node --test tests/core.test.mjs   # ou : npm test
node build.mjs                    # ou : npm run build
```

Les tests (18) vérifient les calculs, la validation des sauvegardes importées et les garanties de stockage. Le build assemble `src/` en un `dist/index.html` autonome et régénère `dist/sw.js` (cache versionné par empreinte) et `dist/manifest.webmanifest`. Aucune dépendance npm n’est requise.

Le dossier `dist/` est prêt à être servi par un hébergement web HTTPS. Son fichier `index.html` contient l’interface, les styles, la logique et le catalogue : aucun framework ni bibliothèque distante n’est nécessaire. Les fichiers complémentaires `manifest.webmanifest`, `sw.js` et les icônes permettent l’installation sur l’écran d’accueil et la mise en cache du programme. Conserver ces fichiers ensemble lors de la publication. Le build préserve les icônes déjà présentes dans `dist/`.

Pour un essai local, servir `dist/` avec un serveur HTTP local, puis ouvrir son adresse dans le navigateur. Éviter l’ouverture directe en `file://`, dont le stockage et les fonctions d’installation dépendent du navigateur. Sur iPhone, ouvrir le lien HTTPS dans Safari, puis utiliser **Partager → Sur l’écran d’accueil**.

## Données et sauvegardes

**Rien n’est envoyé sur GitHub** : ce dépôt ne contient que le code, aucune donnée de calories ni de pesée.

Les données sont enregistrées dans IndexedDB sur l’appareil, pour l’adresse web utilisée. Elles ne sont envoyées à aucun serveur et ne sont pas synchronisées entre iPhones. Le partage du lien partage l’application ; chaque personne conserve son propre suivi. Un ajout n’est confirmé qu’après la fin de sa transaction de stockage.

Exporter régulièrement une sauvegarde JSON depuis les réglages et la conserver dans Fichiers ou iCloud Drive. Une restauration, après confirmation dans l’interface, **remplace l’ensemble du suivi local**, y compris les favoris et réglages. Les fichiers importés sont validés et limités à 5 Mio.

Fonctionnement d’après le code (`src/app.js`, `src/core.js`) :

- **Export** (Réglages → sauvegarde) : génère un fichier JSON `{ app: "pomme", version: 1, exportedAt, data }` contenant tout le suivi validé, à télécharger puis à conserver dans Fichiers ou iCloud Drive. La date de dernière sauvegarde est mémorisée.
- **Import** : le fichier choisi (5 Mio max) est analysé ; les clés JSON en double et les propriétés dangereuses sont refusées, puis le contenu est entièrement reconstruit et validé. Après confirmation, il remplace l’état local dans une transaction IndexedDB.
- **Stockage persistant** : un bouton demande au navigateur de conserver le stockage (`navigator.storage.persist`), sans remplacer une sauvegarde exportée.

Safari et une application installée sur l’écran d’accueil peuvent utiliser des contextes de stockage distincts. Exporter une sauvegarde avant de changer de contexte, de navigateur, d’adresse web ou d’iPhone. L’effacement des données du site peut supprimer le suivi ; le stockage local ne constitue pas une copie de secours indépendante. La disponibilité hors connexion dépend de la première mise en cache réussie du programme.

## Organisation du code

- `src/core.js` : calculs, dates, validation des sauvegardes et transactions IndexedDB.
- `src/app.js`, `src/styles.css`, `src/shell.html` : interface et interactions.
- `src/foods.js` : catalogue et références des valeurs ANSES Ciqual. Les calories dépendent de l’aliment et de sa préparation ; les étiquettes du produit permettent de personnaliser les valeurs.
- `tests/core.test.mjs` : vérifications des calculs, imports et garanties de stockage.
- `dist/icon.svg` : icône vectorielle originale ; les variantes PNG servent à l’installation.

Le plafond initial de 2 000 kcal est un réglage modifiable, sans calcul automatique de recommandation à partir de la taille ou du poids.
