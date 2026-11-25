require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { moisEntre, formaterDuree } = require('./duree');
const { genererDocx, genererPdf } = require('./rendu');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MODELE = process.env.MODELE || 'claude-sonnet-5';

// Dossier des fichiers exportés (cv.docx / cv.pdf). Écrasés à chaque génération, pas d'historique.
const DOSSIER_SORTIE = path.join(__dirname, 'sortie');
fs.mkdirSync(DOSSIER_SORTIE, { recursive: true });

// Extrait le texte visible d'une page HTML : retire script/style, balises, décode les entités courantes.
function htmlVersTexte(html) {
  return String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Récupère le texte de l'offre depuis une URL. Lève err.statut=400 avec un message clair en cas d'échec.
async function recupererOffre(lien) {
  const echec = () => {
    const err = new Error('Lien inaccessible (page bloquée ou indisponible) : colle le texte de l\'offre.');
    err.statut = 400;
    return err;
  };
  let url;
  try {
    url = new URL(lien);
  } catch {
    throw echec();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw echec();

  let html;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CV-ATS/1.0)' },
    });
    if (!res.ok) throw echec();
    html = await res.text();
  } catch (e) {
    throw e.statut ? e : echec();
  }

  const texte = htmlVersTexte(html);
  if (texte.length < 50) throw echec();
  return texte;
}

// Lit et parse profil.json. Lève une erreur typée (err.code) pour des messages distincts.
function lireProfil() {
  let brut;
  try {
    brut = fs.readFileSync(path.join(__dirname, 'profil.json'), 'utf8');
  } catch (e) {
    const err = new Error('profil.json manquant : copie profil.exemple.json en profil.json.');
    err.statut = 400;
    throw err;
  }
  try {
    return JSON.parse(brut);
  } catch (e) {
    const err = new Error('profil.json invalide (JSON mal formé).');
    err.statut = 400;
    throw err;
  }
}

const SYSTEME_ANALYSE = `Tu es un assistant de recrutement. On te donne le PROFIL d'un candidat (JSON) et le TEXTE d'une offre d'emploi.
Compare les exigences de l'offre aux faits du profil et classe-les en trois listes, puis donne un score.

Règles strictes :
- Base-toi UNIQUEMENT sur les faits présents dans le profil. N'invente rien.
- "couvertes" : exigences de l'offre clairement satisfaites par le profil.
- "partielles" : exigences partiellement satisfaites (proche mais incomplet).
- "absentes" : exigences de l'offre introuvables dans le profil.
- "score" : entier de 0 à 100 estimant l'adéquation globale profil/offre.
- "justification" : une phrase courte expliquant le score (points forts / faibles).
- "langue_offre" : "fr" ou "en" selon la langue de l'offre.

Réponds EXCLUSIVEMENT par un objet JSON valide, sans texte autour, de la forme :
{"couvertes":[],"partielles":[],"absentes":[],"score":0,"justification":"","langue_offre":"fr"}`;

async function analyser(profil, texteOffre) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 2000,
    system: SYSTEME_ANALYSE,
    messages: [
      {
        role: 'user',
        content: `PROFIL :\n${JSON.stringify(profil)}\n\nOFFRE :\n${texteOffre}`,
      },
    ],
  });

  return extraireJson(reponse);
}

// Isole et parse le premier objet JSON de la réponse (le modèle peut l'encadrer de texte).
function extraireJson(reponse) {
  const bloc = reponse.content.find((b) => b.type === 'text');
  if (!bloc) throw new Error('Réponse Claude sans texte.');
  const texte = bloc.text.trim();
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut === -1 || fin === -1) throw new Error('Pas de JSON dans la réponse.');
  return JSON.parse(texte.slice(debut, fin + 1));
}

// Clone le profil et injecte une durée calculée en JS sur chaque expérience.
function enrichirProfil(profil, langue) {
  const copie = JSON.parse(JSON.stringify(profil));
  for (const exp of copie.experiences || []) {
    exp.duree = formaterDuree(moisEntre(exp.date_debut, exp.date_fin), langue);
  }
  return copie;
}

const SYSTEME_REDACTION = `Tu es un rédacteur de CV. On te donne le PROFIL enrichi d'un candidat (JSON, source de vérité), le TEXTE d'une offre, et une ANALYSE préalable (exigences couvertes / partielles / absentes).
Rédige le CONTENU d'un CV taillé pour cette offre.

Règles strictes :
- N'utilise QUE les faits présents dans le profil. N'invente, n'extrapole, ne gonfle rien.
- Écris dans la langue indiquée (fr ou en).
- Ordonne les expériences par pertinence vis-à-vis de l'offre (la plus pertinente en premier), en t'appuyant sur les exigences couvertes/partielles.
- N'inclus PAS dans le CV les exigences listées comme "absentes" : elles ne doivent apparaître nulle part.
- Pour chaque expérience : "periode" = "<date_debut> – <date_fin>" (utilise "présent"/"present" si en cours) et "duree" = recopie EXACTEMENT le champ "duree" fourni dans le profil (ne le recalcule pas).
- "realisations" : sélectionne et reformule pour l'offre, sans ajouter de fait absent du profil.
- "competences" : uniquement des éléments issus de profil.competences et profil.outils, priorisés selon l'offre.
- Ne produis NI identité, NI contact, NI langues : ils sont gérés hors du modèle.

Réponds EXCLUSIVEMENT par un objet JSON valide, sans texte autour, de la forme :
{"resume":"","experiences":[{"poste":"","entreprise":"","lieu":"","periode":"","duree":"","realisations":[]}],"formations":[{"diplome":"","etablissement":"","periode":""}],"competences":[]}`;

async function rediger(profil, texteOffre, analyse) {
  const enrichi = enrichirProfil(profil, analyse.langue_offre);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 4000,
    system: SYSTEME_REDACTION,
    messages: [
      {
        role: 'user',
        content: `LANGUE : ${analyse.langue_offre}\n\nPROFIL :\n${JSON.stringify(enrichi)}\n\nANALYSE :\n${JSON.stringify(analyse)}\n\nOFFRE :\n${texteOffre}`,
      },
    ],
  });
  return extraireJson(reponse);
}

const SYSTEME_RELECTURE = `Tu es un relecteur de CV rigoureux. On te donne le PROFIL enrichi d'un candidat (JSON, SEULE source de vérité) et un BROUILLON de CV (JSON) rédigé pour une offre.
Relis le brouillon phrase par phrase et corrige TOI-MÊME tout élément inventé, exagéré ou absent du profil.

Règles strictes :
- Tout fait du CV doit être justifié par le profil. Un fait absent du profil → supprime-le. Un fait exagéré (chiffre gonflé, responsabilité amplifiée, compétence non listée) → ramène-le au niveau du profil ou supprime-le.
- Ne RÉÉCRIS pas le style pour le plaisir : ne touche qu'aux éléments non fidèles. Garde le reste tel quel.
- Conserve EXACTEMENT les champs "periode" et "duree" de chaque expérience (ne les recalcule pas).
- Garde la même langue que le brouillon. Garde la même structure JSON que le brouillon.
- "corrections" : liste de phrases courtes décrivant chaque correction appliquée (ce qui a été retiré/corrigé et pourquoi). Vide si rien à corriger.
- "alertes" : liste de phrases signalant des points de vigilance (formulations limites gardées, incohérences mineures). Vide si aucune.
- "doutes" : liste de points où tu n'as PAS pu trancher seul et où l'utilisateur doit décider. N'y mets un élément QUE si un vrai doute subsiste après correction. Vide sinon.

Réponds EXCLUSIVEMENT par un objet JSON valide, sans texte autour, de la forme :
{"cv":{"resume":"","experiences":[{"poste":"","entreprise":"","lieu":"","periode":"","duree":"","realisations":[]}],"formations":[{"diplome":"","etablissement":"","periode":""}],"competences":[]},"corrections":[],"alertes":[],"doutes":[]}`;

async function relire(profil, cvModele, langue) {
  const enrichi = enrichirProfil(profil, langue);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const reponse = await client.messages.create({
    model: MODELE,
    max_tokens: 4000,
    system: SYSTEME_RELECTURE,
    messages: [
      {
        role: 'user',
        content: `LANGUE : ${langue}\n\nPROFIL (source de vérité) :\n${JSON.stringify(enrichi)}\n\nBROUILLON DE CV :\n${JSON.stringify(cvModele)}`,
      },
    ],
  });
  return extraireJson(reponse);
}

app.post('/api/generer', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ erreur: 'Clé API absente : renseigne ANTHROPIC_API_KEY dans .env.' });
  }

  let texteOffre = (req.body && req.body.texteOffre ? String(req.body.texteOffre) : '').trim();
  const lien = (req.body && req.body.lien ? String(req.body.lien) : '').trim();

  if (!texteOffre && lien) {
    try {
      texteOffre = await recupererOffre(lien);
    } catch (e) {
      return res.status(e.statut || 400).json({ erreur: e.message });
    }
  }
  if (!texteOffre) {
    return res.status(400).json({ erreur: "Offre vide : colle le texte de l'offre ou fournis un lien." });
  }

  let profil;
  try {
    profil = lireProfil();
  } catch (e) {
    return res.status(e.statut || 400).json({ erreur: e.message });
  }

  try {
    const analyse = await analyser(profil, texteOffre);
    const brouillon = await rediger(profil, texteOffre, analyse);
    const releve = await relire(profil, brouillon, analyse.langue_offre);
    const cvModele = releve.cv || brouillon;
    // benevolats/interets : repris verbatim du profil (hors passes LLM), comme identite/langues.
    const cv = {
      identite: profil.identite,
      langues: profil.langues,
      benevolats: profil.benevolats || [],
      interets: profil.interets || [],
      ...cvModele,
    };

    // Export fichiers : une source → deux rendus, écrase les précédents.
    fs.writeFileSync(path.join(DOSSIER_SORTIE, 'cv.docx'), await genererDocx(cv, analyse.langue_offre));
    fs.writeFileSync(path.join(DOSSIER_SORTIE, 'cv.pdf'), await genererPdf(cv, analyse.langue_offre));

    return res.json({
      analyse,
      cv,
      corrections: releve.corrections || [],
      alertes: releve.alertes || [],
      doutes: releve.doutes || [],
    });
  } catch (e) {
    console.error('Échec génération :', e.message);
    return res.status(502).json({ erreur: 'Échec de la génération par Claude. Réessaie.' });
  }
});

// Téléchargement des derniers fichiers générés. 404 si aucune génération n'a encore eu lieu.
for (const nom of ['cv.docx', 'cv.pdf']) {
  app.get(`/telecharger/${nom}`, (req, res) => {
    const fichier = path.join(DOSSIER_SORTIE, nom);
    if (!fs.existsSync(fichier)) {
      return res.status(404).json({ erreur: "Aucun fichier : génère d'abord un CV." });
    }
    res.download(fichier, nom);
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`App prête sur http://localhost:${PORT}`);
  });
}

module.exports = { lireProfil, analyser, rediger, relire, htmlVersTexte, recupererOffre };
