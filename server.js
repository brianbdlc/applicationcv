require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MODELE = process.env.MODELE || 'claude-sonnet-5';

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

  const bloc = reponse.content.find((b) => b.type === 'text');
  if (!bloc) throw new Error('Réponse Claude sans texte.');
  // Le modèle peut encadrer le JSON ; on isole le premier objet.
  const texte = bloc.text.trim();
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut === -1 || fin === -1) throw new Error('Pas de JSON dans la réponse.');
  return JSON.parse(texte.slice(debut, fin + 1));
}

app.post('/api/generer', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ erreur: 'Clé API absente : renseigne ANTHROPIC_API_KEY dans .env.' });
  }

  const texteOffre = (req.body && req.body.texteOffre ? String(req.body.texteOffre) : '').trim();
  if (!texteOffre) {
    return res.status(400).json({ erreur: "Offre vide : colle le texte de l'offre." });
  }

  let profil;
  try {
    profil = lireProfil();
  } catch (e) {
    return res.status(e.statut || 400).json({ erreur: e.message });
  }

  try {
    const analyse = await analyser(profil, texteOffre);
    return res.json({ analyse });
  } catch (e) {
    console.error('Échec analyse :', e.message);
    return res.status(502).json({ erreur: "Échec de l'analyse par Claude. Réessaie." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App prête sur http://localhost:${PORT}`);
});
