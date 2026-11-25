# Plan : Générateur de CV fidèle, optimisé ATS (local)

> PRD source : docs/PRD.md
> Décisions confirmées : PDF via **pdfkit** (pur JS), modèle **Claude Sonnet 5**.

## Décisions architecturales

Décisions durables, valables pour toutes les phases :

- **Stack** : Node.js + Express minimal. `npm install && npm start` ouvre l'app sur
  `http://localhost:3000`. Objectif : un non-dev lance deux commandes.
- **Routes** :
  - `GET /` → page unique (HTML statique, un seul écran).
  - `POST /api/generer` → corps `{ lien?, texteOffre? }` ; retourne `{ analyse, cv, rapport }`.
  - `GET /telecharger/cv.docx` et `GET /telecharger/cv.pdf` → derniers fichiers générés.
- **Données** :
  - `profil.json` — édité à la main, source de vérité (jamais écrit par l'app).
  - `profil.exemple.json` — modèle d'exemple rempli, fourni dans le repo.
  - `.env` — `ANTHROPIC_API_KEY`, jamais en dur dans le code. `MODELE` optionnel
    (défaut `claude-sonnet-5`). `.env` + `profil.json` dans `.gitignore`.
- **LLM** : SDK `@anthropic-ai/sdk`, modèle Sonnet 5. **Trois passes** distinctes :
  1. *Analyse* offre↔profil → 3 listes + score.
  2. *Rédaction* du CV à partir des seuls faits du profil.
  3. *Relecture* phrase par phrase du CV contre le profil → corrections.
- **Durées d'expérience** : calculées **en JS** (fin − début) à partir des dates du profil,
  jamais rédigées par le LLM. Injectées dans le profil transmis au modèle.
- **Modèle CV intermédiaire** : objet structuré en sections (Résumé, Expérience, Formation,
  Compétences). **Une source → deux rendus** : `docx` (lib `docx`) et `pdf` (`pdfkit`),
  pour garantir un `.docx` et un `.pdf` identiques, une colonne, sans tableau/image/icône.
- **Pas d'historique** : `cv.docx` / `cv.pdf` écrasés à chaque génération.
- **Dépendances npm** : `express`, `dotenv`, `@anthropic-ai/sdk`, `docx`, `pdfkit`.
  Avant d'écrire du code appelant ces libs, consulter leur doc à jour via `ctx7`.

**Dépendance externe (PRD)** : le **gabarit de CV actuel** de l'utilisateur doit être fourni
avant la Phase 4 (rendu fichiers). Les phases 1–3 n'en dépendent pas.

---

## Phase 1 : Tracer bullet — offre collée → analyse à l'écran

**User stories** : US-1, US-3, US-4, US-13, US-15, US-16 (partiel)

### Ce qu'on livre

L'app démarre en local et ouvre une page avec une zone de collage du texte de l'offre et un
bouton « Générer ». Au clic, le serveur lit `profil.json` et la clé API depuis `.env`, appelle
Claude pour l'analyse offre↔profil, et affiche à l'écran les **trois listes** (couvertes /
partiellement couvertes / absentes) et un **score de correspondance chiffré**. Messages
d'erreur clairs : `profil.json` manquant/invalide, clé API absente, offre vide.

### Critères d'acceptation

- [ ] `npm install && npm start` sert la page sur `http://localhost:3000`.
- [ ] Coller un texte d'offre + Générer affiche les 3 listes et un score chiffré.
- [ ] `profil.exemple.json` est fourni et documenté comme modèle à copier en `profil.json`.
- [ ] Erreurs distinctes et lisibles : profil manquant, profil JSON invalide, clé API absente, offre vide.
- [ ] La clé API n'apparaît nulle part dans le code (lue via `.env`) ; `.env` et `profil.json` sont `.gitignore`.

## Bloquée par

- Aucune — démarrable immédiatement.

---

## Phase 2 : Génération du CV fidèle au profil

**User stories** : US-5, US-6, US-8, US-9, US-11

### Ce qu'on livre

Après l'analyse, l'app génère le **contenu** du CV (passe de rédaction) en n'utilisant **que**
les faits du `profil.json`, dans la **langue de l'offre** (fr/en, déduite), avec les
expériences les plus pertinentes **en haut**. Les durées affichées proviennent du **calcul JS**
des dates. Les exigences non remplies sont **exclues du CV** mais listées « absent, ignoré ».
Le CV est affiché à l'écran (texte/HTML) sous les 3 listes.

### Critères d'acceptation

- [ ] Le CV affiché ne contient aucune compétence/outil/diplôme/titre/réalisation absent de `profil.json`.
- [ ] Les durées affichées = fin − début calculé en code (vérifiable contre le profil).
- [ ] La langue du CV suit la langue de l'offre (offre fr → CV fr ; offre en → CV en).
- [ ] Les expériences les plus pertinentes pour l'offre apparaissent en premier.
- [ ] Les exigences non couvertes figurent dans une section « absent, ignoré » et pas dans le CV.

## Bloquée par

- Phase 1 (analyse + lecture profil/offre).

---

## Phase 3 : Relecture automatique + rapport complet

**User stories** : US-7, US-14 ; complète US-4/US-9/US-13 en un rapport unique

### Ce qu'on livre

Passe de **relecture** : l'app relit le CV phrase par phrase contre le profil, **corrige seule**
tout élément inventé ou exagéré, puis réaffiche le CV final **accompagné de la liste des
corrections**. Un **rapport** consolidé s'affiche : score, 3 listes, section « absent, ignoré »,
corrections et **alertes**. L'utilisateur n'est sollicité (choix à trancher) **que si un doute
persiste** après correction.

### Critères d'acceptation

- [ ] Un fait absent/exagéré injecté dans un brouillon de CV est retiré/corrigé par la passe de relecture.
- [ ] La liste des corrections appliquées est affichée avec le CV final.
- [ ] Le rapport affiche : score chiffré, 3 listes, « absent, ignoré », alertes.
- [ ] L'utilisateur n'est sollicité que lorsqu'un doute subsiste après correction (sinon flux automatique).

## Bloquée par

- Phase 2 (CV rédigé à relire).

---

## Phase 4 : Export `.docx` + `.pdf` dans le gabarit ATS

**User stories** : US-10, US-12

### Ce qu'on livre

Le CV validé est rendu depuis le **modèle intermédiaire** en `.docx` (lib `docx`) et `.pdf`
(`pdfkit`), **une seule colonne**, sections Résumé / Expérience / Formation / Compétences,
**sans tableau, image ni icône**, suivant le gabarit fourni par l'utilisateur. Deux liens de
téléchargement apparaissent ; les fichiers précédents sont écrasés.

### Critères d'acceptation

- [ ] Génération produit un `cv.docx` ET un `cv.pdf` téléchargeables.
- [ ] Les deux fichiers : une colonne, mêmes sections, aucun tableau/image/icône.
- [ ] Le contenu des fichiers correspond au CV validé affiché (mêmes faits, même langue, même ordre).
- [ ] Une nouvelle offre écrase les fichiers précédents (pas d'historique).

## Bloquée par

- Phase 3 (CV final validé) **et** réception du gabarit de CV de l'utilisateur.

---

## Phase 5 : Récupération de l'offre par lien

**User stories** : US-2, US-16 (lien inaccessible)

### Ce qu'on livre

Un champ **lien** à côté de la zone de collage. À la génération, l'app tente de récupérer le
texte de l'offre depuis l'URL et enchaîne le même pipeline (analyse → CV → relecture → fichiers).
En cas d'échec (page bloquée type LinkedIn, lien mort), message clair invitant à **coller le
texte** (plan B déjà en place depuis la Phase 1).

### Critères d'acceptation

- [ ] Un lien d'offre accessible lance le pipeline sans copier-coller.
- [ ] Un lien inaccessible affiche un message invitant à coller le texte, sans planter.
- [ ] Le collage de texte reste pleinement fonctionnel en repli.

## Bloquée par

- Phase 1 (pipeline + endpoint). Peut être livrée après la Phase 1 indépendamment des phases 2–4.

---

## Vérification (bout en bout)

1. Copier `profil.exemple.json` → `profil.json`, remplir `.env` avec `ANTHROPIC_API_KEY`.
2. `npm install && npm start`, ouvrir `http://localhost:3000`.
3. Coller une offre **française**, Générer → vérifier 3 listes + score (P1), CV fr sans faits
   hors profil + durées = calcul (P2), corrections + rapport + alertes (P3).
4. Télécharger `cv.docx` / `cv.pdf` → vérifier une colonne, sections, pas de tableau/image,
   contenu identique à l'écran (P4).
5. Rejouer avec une offre **anglaise** → CV en anglais ; vérifier l'écrasement des fichiers.
6. Tester les erreurs : sans `.env`, sans `profil.json`, `profil.json` invalide, offre vide,
   lien inaccessible (P5) → messages clairs.
7. Check ciblé fidélité (contrainte forte du PRD) : un petit script/test qui compare les
   compétences/outils/titres du CV généré au `profil.json` et échoue si un item est absent.
