## Problème

L'utilisateur postule à de nombreuses offres d'emploi. Adapter son CV à la main pour chaque
offre est long et répétitif. Les outils IA génériques, eux, inventent ou gonflent des
informations — compétences, outils, dates, réalisations — ce qui l'expose à mentir sur son
CV et à être recalé par les filtres ATS. Il veut un CV taillé pour chaque offre, optimisé
ATS, mais garanti 100 % fidèle à ses faits réels : rien qui ne figure pas déjà dans son
profil.

## Solution

Une petite application locale. L'utilisateur maintient un **profil maître** unique, seule
source de vérité. Pour chaque offre (lien ou texte collé si la page est bloquée), l'app :
analyse l'offre face au profil et sort trois listes (exigences couvertes, partiellement
couvertes, absentes) ; rédige un CV dans son gabarit en n'utilisant **que** ses faits ;
relit le CV phrase par phrase contre le profil et corrige tout élément absent ou exagéré ;
puis produit un CV en `.docx` et `.pdf` plus un rapport (score de correspondance, exigences
ignorées, alertes). L'utilisateur travaille depuis une page web locale ouverte dans son
navigateur.

## Utilisateur cible

L'utilisateur lui-même : non-développeur, en recherche active d'emploi, postulant à
plusieurs offres francophones et anglophones. Il travaille sur son propre ordinateur, est à
l'aise pour remplir un fichier texte structuré mais pas pour coder. Il possède une clé API
Anthropic.

## User Stories

US-1 — En tant que candidat, je veux maintenir mon profil maître dans un fichier que j'édite
à la main, afin de garder le contrôle total des faits-source.
US-2 — En tant que candidat, je veux fournir une offre via son lien, afin de lancer une
génération sans copier-coller.
US-3 — En tant que candidat, je veux pouvoir coller le texte de l'offre quand la page est
bloquée (ex. LinkedIn), afin de ne jamais être bloqué par un lien inaccessible.
US-4 — En tant que candidat, je veux voir les exigences de l'offre classées en couvertes /
partiellement couvertes / absentes, afin de savoir où je me situe face au poste.
US-5 — En tant que candidat, je veux un CV rédigé uniquement à partir des faits de mon
profil, afin de ne jamais mentir.
US-6 — En tant que candidat, je veux que les durées d'expérience soient calculées à partir
des dates du profil, afin qu'aucune durée ne soit écrite librement par l'IA.
US-7 — En tant que candidat, je veux que l'app corrige seule tout élément inventé ou exagéré
puis me montre la liste des corrections, afin d'obtenir un CV fiable sans intervenir à
chaque fois.
US-8 — En tant que candidat, je veux que le CV soit dans la langue de l'offre (français ou
anglais), afin de coller aux attentes du recruteur.
US-9 — En tant que candidat, je veux que les exigences que je ne remplis pas soient ignorées
dans le CV mais listées dans le rapport comme « absent, ignoré », afin de rester honnête
tout en sachant ce qui me manque.
US-10 — En tant que candidat, je veux un CV optimisé ATS (une colonne, sections classiques,
sans tableau, image ni icône), afin de passer les filtres automatiques.
US-11 — En tant que candidat, je veux les expériences les plus pertinentes pour le poste en
haut du CV, afin de capter l'attention du recruteur.
US-12 — En tant que candidat, je veux télécharger le CV en `.docx` et en `.pdf`, afin de
l'envoyer sous les deux formats.
US-13 — En tant que candidat, je veux un score de correspondance chiffré, afin d'évaluer si
l'offre vaut une candidature.
US-14 — En tant que candidat, je veux être sollicité uniquement en cas de doute persistant
après correction, afin de trancher moi-même les cas ambigus.
US-15 — En tant que candidat, je veux fournir ma clé API via un fichier `.env` jamais exposé
dans le code, afin de garder ma clé privée.
US-16 — En tant que candidat, je veux des messages clairs quand quelque chose échoue (lien
inaccessible, offre vide, profil manquant ou invalide, clé API absente), afin de savoir quoi
corriger.

## Critères de succès

- À partir d'une offre, l'app produit un fichier `.docx` ET un fichier `.pdf` téléchargeables.
- Le rapport affiche un score de correspondance chiffré, les trois listes
  (couvertes / partielles / absentes), une section « absent, ignoré » et les alertes.
- Aucune compétence, aucun outil, aucun diplôme, aucun titre ni aucune réalisation du CV ne
  figure hors du `profil.json` (vérifiable en comparant CV et profil).
- Les durées d'expérience affichées correspondent au calcul (date de fin − date de début).
- Le CV est sur une seule colonne, avec les sections Résumé, Expérience, Formation,
  Compétences, sans tableau, image ni icône.
- La langue du CV correspond à la langue de l'offre.
- La clé API n'apparaît jamais dans le code (elle est lue depuis `.env`).

## Hors périmètre

- Lettre de motivation.
- Formulaire de saisie du profil dans l'app (le profil est édité à la main).
- Historique ou archivage des CV générés (écrasement à chaque génération).
- Candidature ou envoi automatique aux offres.
- Hébergement en ligne et usage multi-utilisateurs.
- Langues autres que le français et l'anglais.
- Toute invention, extrapolation ou gonflement de contenu.

## Décisions d'implémentation

- Form factor : page web locale qui s'ouvre dans le navigateur.
- Entrée de l'offre : un champ pour le lien et une zone de collage de texte (plan B quand le
  lien est bloqué).
- Vérification : correction automatique puis réaffichage du CV final accompagné de la liste
  des corrections ; l'utilisateur n'est sollicité que si un doute persiste après correction.
- Profil : édité à la main dans `profil.json` ; un modèle d'exemple rempli est fourni.
- Historique : un seul CV et un seul rapport, écrasés à chaque nouvelle offre.
- Sortie : deux fichiers téléchargeables (`.docx` et `.pdf`) et un rapport affiché à l'écran.
- Score de correspondance affiché de façon chiffrée.
- Langue du CV déduite de l'offre (français ou anglais).
- Messages d'erreur visibles : lien inaccessible → invitation à coller le texte ; offre
  vide ; `profil.json` manquant ou invalide ; clé API absente.

## Notes complémentaires

- Dépendance : le gabarit de CV actuel de l'utilisateur doit être fourni avant de produire la
  sortie `.docx` / `.pdf` (à transmettre avant l'étape de génération des fichiers).
- Dépendance : clé API Anthropic valide dans `.env`.
- Hypothèse : `profil.json` contient des dates exactes début/fin pour chaque expérience, sans
  quoi les durées ne peuvent être calculées.
- Risque : certaines pages d'offres (ex. LinkedIn) ne sont pas récupérables par lien ; le
  plan B (collage du texte) couvre ce cas.
- Risque : la qualité de l'analyse et du CV dépend de la complétude du profil maître.
