# Pomme — calories et poids

Une petite application en français, adaptée à Safari sur iPhone : journal quotidien des calories, plafond réglable, profil personnalisable, aliments avec icônes et jusqu’à neuf favoris sur l’accueil, saisie au pavé numérique avec quantité, pesées datées et graphique d’évolution. Un bilan rouge indique les dépassements du plafond. Aucune consommation ni pesée de démonstration n’est enregistrée.

La version 11 enrichit le sélecteur alimentaire : **60 icônes conservées + 52 nouvelles = 112 choix**. Sur les 58 emojis demandés, 6 existaient déjà (🥣 🍝 🍣 🍚 🍵 🥯). Le compteur est calculé automatiquement. Les identifiants, valeurs et libellés des icônes initiales sont conservés ; les nouvelles ont un identifiant stable et un nom français. Les variantes Unicode de présentation sont dédoublonnées sans modifier les valeurs déjà enregistrées. La séquence du citron vert reste distincte du citron.

La grille garde six colonnes dès 320 px, des cibles d’au moins 44 × 46 px et le défilement vertical du formulaire. Les symboles ✓ et ! de l’historique sont centrés dans leurs pastilles, avec des tracés vectoriels locaux indépendants de la police. Aucun changement des calculs, des autres champs ou du stockage.

La version 10 simplifie **Historique** : un calendrier mensuel en haut de page et un seul bilan pour le jour sélectionné. Les jours écoulés comportant des saisies affichent ✓ en vert si le quota a été respecté, ! en rouge s’il a été dépassé. Une égalité reste verte. Les journées sans saisie sont neutres, aujourd’hui reste en cours et les dates futures sont désactivées. Les flèches permettent de consulter les mois précédents.

Le bilan reprend le **plafond enregistré pour cette journée**, son total de calories, la barre de progression et le dépassement éventuel. La barre est plafonnée visuellement à 100 %, avec le dépassement chiffré en rouge. **Voir la journée** ouvre son journal pour le consulter ou le corriger. Les anciennes cartes répétées et leur sélecteur de date sont retirés de la page Historique ; le sélecteur du journal reste disponible. Le calendrier ne crée ni ne modifie aucune donnée lors de la consultation.

La version 9 remplace le texte visible de sauvegarde dans les en-têtes par un petit téléphone vert à droite de **Mon carnet quotidien**. Toucher ce symbole ouvre directement **Mes données** depuis toutes les pages. Le dessin de 18 px dispose d’une cible tactile de 44 × 44 px. Le statut reste accessible aux lecteurs d’écran et les erreurs sont signalées ; le raccourci reste désactivé tant que le carnet n’a pas pu être ouvert.

La version 7 propose **60 icônes alimentaires** dans une seule grille pour créer ou modifier un aliment : les 24 précédentes et 36 nouvelles. Un compteur indique les choix disponibles et le nom de l’icône sélectionnée apparaît sous la grille. Les anciennes icônes, y compris celles importées hors catalogue, restent conservées.

L’identité agrandie de la version 6 est conservée : nom **Pomme**, pomme verte du logo et signature **Mon carnet quotidien**. Sur l’accueil, l’encadré du profil se trouve sous le titre du journal et sa date, avant le sélecteur de journée.

## Lien de l’application

Version en ligne : https://pomme-calories-poids.brownpin256.chatgpt.site/

L’hébergement est inchangé et géré en dehors de GitHub. Ce dépôt sert uniquement à conserver le code source : aucune publication GitHub Pages ni déploiement automatique n’y est configuré.

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

- Créer ou modifier un aliment personnel permet de choisir parmi 112 icônes dans une grille unique, avec le nombre de choix et le nom de l’icône sélectionnée. Une ancienne icône absente du catalogue reste proposée comme choix supplémentaire lors de la modification de cet aliment.
- Neuf favoris maximum sont sélectionnables. Les anciens carnets qui en contiennent davantage sont conservés intégralement ; les neuf premiers apparaissent sur l’accueil, et il faut retirer des étoiles pour en choisir de nouveaux.
- Pour un café à 40 kcal par tasse, saisir 3 tasses ajoute une seule ligne à 120 kcal. La quantité d’une ligne existante est modifiable. La saisie libre accepte également un nombre de portions.
- Les ajouts historiques sans quantité sont traités comme une portion de leur valeur initiale : aucun total n’est deviné à partir d’un texte libre.

## Données et sauvegardes

Les données sont enregistrées dans IndexedDB sur l’appareil, pour l’adresse web utilisée. Elles ne sont envoyées à aucun serveur et ne sont pas synchronisées entre iPhones. Le partage du lien partage l’application ; chaque personne conserve son propre suivi. Un ajout n’est confirmé qu’après la fin de sa transaction de stockage.

Exporter régulièrement une sauvegarde JSON depuis **Réglages → Mes données** et la conserver dans Fichiers ou iCloud Drive. Une restauration, après confirmation dans l’interface, **remplace l’ensemble du suivi local**, y compris les favoris et réglages. Les fichiers importés sont validés et limités à 5 Mio.

Safari et une application installée sur l’écran d’accueil peuvent utiliser des contextes de stockage distincts. Exporter une sauvegarde avant de changer de contexte, de navigateur, d’adresse web ou d’iPhone. L’effacement des données du site peut supprimer le suivi ; le stockage local ne constitue pas une copie de secours indépendante. La disponibilité hors connexion dépend de la première mise en cache réussie du programme.

Le lien de référence reste https://pomme-calories-poids.brownpin256.chatgpt.site/ . Le nom de la base IndexedDB (`pomme-local-v1`), sa version d’ouverture (`1`), le magasin (`state`) et sa clé (`singleton`) restent identiques ; aucune réinitialisation n’est réalisée.

La version 11 conserve le format de données et de sauvegarde **3**, et accepte toujours les formats **1, 2 et 3**. Les anciennes consommations, favoris, profils, pesées et informations de pas restent conservés. Les valeurs absentes d’un ancien carnet reçoivent les valeurs par défaut prévues par le format. Après une mise à jour, actualiser les onglets Pomme déjà ouverts.

## Organisation du code

- `src/core.js` : calculs, dates, validation des sauvegardes et transactions IndexedDB.
- `src/app.js`, `src/styles.css`, `src/shell.html` : interface et interactions.
- `src/food-icons.js` : les 112 icônes, identifiants stables, libellés français et normalisation Unicode ; `tests/food-icons.test.mjs` vérifie la conservation et le dédoublonnage.
- `src/history.js` : calendrier mensuel et bilans en lecture seule, utilisant les calculs existants.
- `tests/history.test.mjs` : quotas historiques, mois et dates limites, jours vides et absence de mutation.
- `src/foods.js` : catalogue et références des valeurs ANSES Ciqual. Les calories dépendent de l’aliment et de sa préparation ; les étiquettes du produit permettent de personnaliser les valeurs.
- `tests/core.test.mjs` : vérifications des calculs, imports et garanties de stockage.
- `dist/icon.svg` : icône vectorielle originale ; les variantes PNG servent à l’installation.

## Vérifications de la version 11

**55 tests réussis** : 37 du cœur, 10 du calendrier et 8 des icônes. Les 60 anciens choix ont été comparés au code source de production : valeurs, identifiants implicites, libellés et ordre identiques. Tous les emojis demandés figurent exactement une fois après normalisation NFC et suppression des sélecteurs de présentation FE0E/FE0F ; ZWJ conservé. Les icônes hors catalogue restent proposées sans réécriture de leur valeur. Les 112 emojis passent aussi un aller-retour de sauvegarde/restauration en mémoire sans altération.

Syntaxe, build `6651a287a4de`, diff et relecture indépendante vérifiés. Contrôles IAB WebKit à 320, 360 et 393 px : 112 radios, six colonnes, aucun débordement, cibles de 44 × 46 px minimum et défilement vertical. Un aliment fictif avec 🍋‍🟩 a été sélectionné, enregistré, retrouvé après rechargement et rouvert en édition avec la même valeur et le même identifiant. Les pastilles du calendrier et de sa légende sont centrées horizontalement et verticalement à 320 et 393 px. Les historiques, quotas, profil et favoris du carnet fictif existant sont repris. Aucun test dans le carnet de production, aucune erreur de console observée.

Limite : tests dans WebKit sur Mac à des largeurs mobiles, sans iPhone physique. Les emojis sont ceux du système ; le citron vert nécessite la prise en charge Emoji 15.1, introduite sur iPhone dans [iOS 17.4 selon Apple](https://support.apple.com/en-ie/118723). Sur un système plus ancien, sa séquence peut s’afficher séparément ; la valeur enregistrée reste intacte.

## Vérifications de la version 10

**47 tests réussis** : les 37 tests existants du cœur et 10 tests du calendrier. Syntaxe, build `50e1100a8705`, diff et relecture indépendante validés. Le calendrier est contrôlé sans mutation, notamment avec des données gelées : quotas historiques, égalité et dépassement, vraie entrée à zéro calorie, journée vide, jour en cours, dates futures, années bissextiles et changements de mois/année.

Recette locale IAB WebKit avec le carnet fictif existant : mois courant affiché à l’ouverture, navigation mensuelle, sélection d’un jour, bilan rouge de 2 415,19 kcal pour 2 200 kcal, ancien plafond de 2 100 kcal conservé pour une journée à 100 kcal, jours sans saisie neutres, ouverture du journal et retour au calendrier. Profil, neuf favoris, pesées et consommations existantes repris. Affichage sans débordement à 320 et 393 px, barre de 7 px. Après rechargement, l’historique s’ouvre sur le mois courant. Aucun enregistrement de test dans le carnet de production, aucun essai sur iPhone physique. L’annonce automatique du bilan avec VoiceOver n’a pas été testée.

## Vérifications de la version 9

Syntaxe, construction et diff vérifiés. Recette IAB WebKit : raccourci vers **Mes données** depuis les dix vues, un seul symbole placé exactement comme dans l’aperçu validé. Aucun débordement à 320 et 393 px, cible 44 × 44 px, activation au clavier vérifiée. Le carnet fictif existant est repris ; aucun enregistrement n’a été effectué pendant ces contrôles de navigation. Relecture indépendante et quatre scénarios de démarrage isolés validés : chargement en attente et échecs d’ouverture, de lecture ou d’écriture initiale de la base ; le raccourci reste désactivé et les erreurs sont préservées. Le cœur, le catalogue de 60 icônes et le format des données sont inchangés. Aucun essai sur iPhone physique ; la suite du cœur n’a pas été relancée pour cette modification d’interface.

## Vérifications de la version 8

Syntaxe, build `be68047e7271` et diff vérifiés. Dans IAB WebKit, le statut est aligné sur la date à 320 et 393 px, sans doublon. La navigation, le changement de journée et le retour après sauvegarde du profil conservent le statut et son texte actualisé. Le cœur, le stockage et les 60 icônes sont inchangés. Aucun essai sur iPhone physique ; la suite du cœur n’a pas été relancée pour ce déplacement visuel.

## Vérifications de la version 7

La syntaxe, la construction et le diff ont été vérifiés ; le build porte l’empreinte `ba93a50f64a5`. Les 60 icônes correspondent exactement à l’aperçu validé, sans doublon, et les 24 anciennes sont conservées. Le cœur de l’application et les tests sont inchangés ; les 37 tests réussis en version 5 n’ont pas été relancés.

Dans WebKit, la grille a été contrôlée à 320, 360 et 393 pixels, sans débordement, avec des cibles d’au moins 44 × 46 pixels. La création d’un aliment fictif avec 🥑, sa persistance après rechargement et son édition ont été vérifiées. Les exports du carnet de référence en versions 6 et 7 sont identiques hors horodatages `exportedAt`, `updatedAt` et `lastBackupAt`. Aucun essai sur iPhone physique n’a été effectué.

### Référence : vérifications de la version 6

La syntaxe de `app.js`, la construction et `git diff --check` ont été vérifiés ; le build porte l’empreinte `6e15c9e1a874`. Le fichier `core.js` est inchangé. La suite de 37 tests, réussie pour la version 5, n’a pas été relancée pour cette modification strictement visuelle.

Dans WebKit, un carnet fictif existant conserve six consommations totalisant 2 415,19 kcal, un plafond de 2 200 kcal, neuf favoris et le profil Camille à 72,2 kg. La veille conserve 100 kcal et son plafond de 2 100 kcal. Le bouton du profil déplacé ouvre toujours **Mon profil**.

Les captures à 320 et 390 pixels confirment l’agrandissement du nom, du logo et de la signature sans chevauchement. L’encadré du profil apparaît après le titre et la date du journal, avant le sélecteur de journée. Aucun essai sur iPhone physique n’a été effectué.

### Référence : vérifications de la version 5

Les **37 tests automatisés du cœur de l’application** réussissent. La syntaxe de `app.js` et la construction ont également été vérifiées ; le build porte l’empreinte `d38ba84896f0`. Les vérifications d’interface ci-dessous sont des essais manuels dans WebKit, avec des données fictives.

La page Réglages présente cinq options directes avec leurs icônes, sans menu déroulant. Le formulaire de profil contient uniquement le nom et les 48 choix d’avatars dans une seule grille. La modification du nom et de l’avatar Feuille, la conservation du brouillon après un aller-retour dans les réglages et le quota, le retour à l’accueil après enregistrement et la persistance après rechargement ont été vérifiés. Une pesée de 72,2 kg saisie dans l’onglet Poids actualise automatiquement le poids affiché sur l’accueil et dans le profil.

La reprise de l’ancien carnet conserve neuf favoris et six consommations totalisant 2 415,19 kcal, avec un plafond de 2 200 kcal. L’export au format 3 a été comparé à la sauvegarde précédente : journées et aliments identiques, favoris, quotas et anciens champs d’âge, de sexe, de taille et d’activité conservés. Seules les modifications volontaires du test — nom, avatar et pesée — changent les données concernées.

Les cinq options de réglage ont été inspectées visuellement, ainsi que le profil et sa grille d’avatars à 320 pixels et l’accueil à 320 et 390 pixels. Aucun essai sur iPhone physique n’a été effectué.
