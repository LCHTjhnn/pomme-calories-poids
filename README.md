# Pomme — calories et poids

Une petite application en français, adaptée à Safari sur iPhone : journal quotidien des calories, plafond réglable, profil personnalisable, aliments avec icônes et jusqu’à neuf favoris sur l’accueil, saisie au pavé numérique avec quantité, pesées datées et graphique d’évolution. Un bilan rouge indique les dépassements du plafond. Aucune consommation ni pesée de démonstration n’est enregistrée.

La version 6 agrandit le nom **Pomme**, la pomme verte du logo et la signature **Mon carnet quotidien**. Sur l’accueil, l’encadré du profil se trouve sous le titre du journal et sa date, avant le sélecteur de journée. Cette mise à jour est uniquement visuelle.

## Lien de l’application

Version en ligne : https://pomme-calories-poids.brownpin256.chatgpt.site/

L’hébergement est inchangé et géré en dehors de GitHub. Ce dépôt privé sert uniquement à conserver le code source : aucune publication GitHub Pages ni déploiement automatique n’y est configuré.

## Construire et vérifier

Depuis ce dossier, avec Node.js :

```sh
node build.mjs
node --test tests/*.test.mjs
```

Le dossier `dist/` est prêt à être servi par un hébergement web HTTPS. Son fichier `index.html` contient l’interface, les styles, la logique et le catalogue : aucun framework ni bibliothèque distante n’est nécessaire. Les fichiers complémentaires `manifest.webmanifest`, `sw.js` et les icônes permettent l’installation sur l’écran d’accueil et la mise en cache du programme. Conserver ces fichiers ensemble lors de la publication. Le build préserve les icônes déjà présentes dans `dist/`.

Pour un essai local, servir `dist/` avec un serveur HTTP local, puis ouvrir son adresse dans le navigateur. Éviter l’ouverture directe en `file://`, dont le stockage et les fonctions d’installation dépendent du navigateur. Sur iPhone, ouvrir le lien HTTPS dans Safari, puis utiliser **Partager → Sur l’écran d’accueil**.

## Profil et réglages

La page **Réglages** propose directement cinq options avec leurs emojis : **Mon profil**, **Mon quota**, **Mes données**, **Sur mon iPhone** et **Sources**. Il n’y a plus de menu déroulant ni de sous-menu de profil.

Dans **Mon profil**, modifier simplement le **nom** et choisir un **avatar** parmi 48 emojis réunis dans une seule grille. Le nom reprend la valeur précédemment enregistrée. **Enregistrer mon profil** ramène à l’accueil du jour uniquement après la réussite de la sauvegarde. En cas d’échec, les informations saisies restent disponibles pour réessayer.

Le profil affiche uniquement l’avatar, le nom et le dernier poids connu. Le poids vient automatiquement de la dernière pesée datée enregistrée dans l’onglet **Poids** ; il n’est pas saisi dans le profil. En l’absence de pesée, aucun poids n’est inventé.

La taille, le sexe et l’âge ne sont plus affichés ni demandés. Les anciennes valeurs restent conservées dans le carnet et les sauvegardes, sans intervenir dans le quota. Ces données restent locales.

## Quota et dépassement

Le plafond initial de 2 000 kcal est un réglage modifiable dans **Réglages → Mon quota**, sans calcul automatique de recommandation à partir du profil. Modifier ce plafond concerne aujourd’hui et les nouvelles journées ; les journées passées conservent leur plafond de base.

Depuis la version 4, les pas quotidiens et leur bonus sont retirés de l’interface. Le plafond de chaque journée correspond désormais uniquement à son plafond de base, y compris dans l’historique. Les anciennes informations de pas sont conservées dans les données et les sauvegardes pour éviter toute suppression, mais n’influencent plus les calories disponibles.

Quand les calories consommées dépassent le plafond de la journée, le bilan devient rouge et une infographie indique la quantité consommée, le plafond et le dépassement exact. La barre distingue le plafond et la part dépassée. Le message reste compréhensible sans dépendre uniquement de la couleur.

## Aliments, favoris et quantités

- Créer ou modifier un aliment personnel permet de choisir son icône.
- Neuf favoris maximum sont sélectionnables. Les anciens carnets qui en contiennent davantage sont conservés intégralement ; les neuf premiers apparaissent sur l’accueil, et il faut retirer des étoiles pour en choisir de nouveaux.
- Pour un café à 40 kcal par tasse, saisir 3 tasses ajoute une seule ligne à 120 kcal. La quantité d’une ligne existante est modifiable. La saisie libre accepte également un nombre de portions.
- Les ajouts historiques sans quantité sont traités comme une portion de leur valeur initiale : aucun total n’est deviné à partir d’un texte libre.

## Données et sauvegardes

**Rien n’est envoyé sur GitHub** : ce dépôt ne contient que le code, aucune donnée de calories ni de pesée.

Les données sont enregistrées dans IndexedDB sur l’appareil, pour l’adresse web utilisée. Elles ne sont envoyées à aucun serveur et ne sont pas synchronisées entre iPhones. Le partage du lien partage l’application ; chaque personne conserve son propre suivi. Un ajout n’est confirmé qu’après la fin de sa transaction de stockage.

Exporter régulièrement une sauvegarde JSON depuis **Réglages → Mes données** et la conserver dans Fichiers ou iCloud Drive. Une restauration, après confirmation dans l’interface, **remplace l’ensemble du suivi local**, y compris les favoris et réglages. Les fichiers importés sont validés et limités à 5 Mio.

Safari et une application installée sur l’écran d’accueil peuvent utiliser des contextes de stockage distincts. Exporter une sauvegarde avant de changer de contexte, de navigateur, d’adresse web ou d’iPhone. L’effacement des données du site peut supprimer le suivi ; le stockage local ne constitue pas une copie de secours indépendante. La disponibilité hors connexion dépend de la première mise en cache réussie du programme.

Le lien de référence reste https://pomme-calories-poids.brownpin256.chatgpt.site/ . Le nom de la base IndexedDB (`pomme-local-v1`), sa version d’ouverture (`1`), le magasin (`state`) et sa clé (`singleton`) restent identiques ; aucune réinitialisation n’est réalisée.

La version 6 conserve le format de données et de sauvegarde **3**, et accepte toujours les formats **1, 2 et 3**. Les anciennes consommations, favoris, profils, pesées et informations de pas restent conservés. Les valeurs absentes d’un ancien carnet reçoivent les valeurs par défaut prévues par le format. Après une mise à jour, actualiser les onglets Pomme déjà ouverts.

## Organisation du code

- `src/core.js` : calculs, dates, validation des sauvegardes et transactions IndexedDB.
- `src/app.js`, `src/styles.css`, `src/shell.html` : interface et interactions.
- `src/foods.js` : catalogue et références des valeurs ANSES Ciqual. Les calories dépendent de l’aliment et de sa préparation ; les étiquettes du produit permettent de personnaliser les valeurs.
- `tests/core.test.mjs` : vérifications des calculs, imports et garanties de stockage.
- `dist/icon.svg` : icône vectorielle originale ; les variantes PNG servent à l’installation.

## Vérifications de la version 6

La syntaxe de `app.js`, la construction et `git diff --check` ont été vérifiés ; le build porte l’empreinte `6e15c9e1a874`. Le fichier `core.js` est inchangé. La suite de 37 tests, réussie pour la version 5, n’a pas été relancée pour cette modification strictement visuelle.

Dans WebKit, un carnet fictif existant conserve six consommations totalisant 2 415,19 kcal, un plafond de 2 200 kcal, neuf favoris et le profil Camille à 72,2 kg. La veille conserve 100 kcal et son plafond de 2 100 kcal. Le bouton du profil déplacé ouvre toujours **Mon profil**.

Les captures à 320 et 390 pixels confirment l’agrandissement du nom, du logo et de la signature sans chevauchement. L’encadré du profil apparaît après le titre et la date du journal, avant le sélecteur de journée. Aucun essai sur iPhone physique n’a été effectué.

### Référence : vérifications de la version 5

Les **37 tests automatisés du cœur de l’application** réussissent. La syntaxe de `app.js` et la construction ont également été vérifiées ; le build porte l’empreinte `d38ba84896f0`. Les vérifications d’interface ci-dessous sont des essais manuels dans WebKit, avec des données fictives.

La page Réglages présente cinq options directes avec leurs icônes, sans menu déroulant. Le formulaire de profil contient uniquement le nom et les 48 choix d’avatars dans une seule grille. La modification du nom et de l’avatar Feuille, la conservation du brouillon après un aller-retour dans les réglages et le quota, le retour à l’accueil après enregistrement et la persistance après rechargement ont été vérifiés. Une pesée de 72,2 kg saisie dans l’onglet Poids actualise automatiquement le poids affiché sur l’accueil et dans le profil.

La reprise de l’ancien carnet conserve neuf favoris et six consommations totalisant 2 415,19 kcal, avec un plafond de 2 200 kcal. L’export au format 3 a été comparé à la sauvegarde précédente : journées et aliments identiques, favoris, quotas et anciens champs d’âge, de sexe, de taille et d’activité conservés. Seules les modifications volontaires du test — nom, avatar et pesée — changent les données concernées.

Les cinq options de réglage ont été inspectées visuellement, ainsi que le profil et sa grille d’avatars à 320 pixels et l’accueil à 320 et 390 pixels. Aucun essai sur iPhone physique n’a été effectué.
