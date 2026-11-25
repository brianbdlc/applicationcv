// Check live : un fait inventé/exagéré dans un brouillon doit être retiré par la passe de relecture.
// Nécessite profil.json + ANTHROPIC_API_KEY. Lancer : node relecture.test.js
require('dotenv').config();
const assert = require('assert');
const { lireProfil, relire } = require('./server');

const PLANTE = 'Direction d\'une équipe de 50 personnes sur un projet chez Google.'; // absent du profil

const brouillon = {
  resume: 'Développeuse full-stack avec 5 ans d\'expérience.',
  experiences: [
    {
      poste: 'Développeuse full-stack',
      entreprise: 'Atelier Numérique',
      lieu: 'Lyon, France',
      periode: '2021-09 – présent',
      duree: '3 ans 2 mois',
      realisations: [
        'Conception et maintenance d\'une application de gestion interne en Node.js et React.',
        PLANTE, // fait inventé à détecter
      ],
    },
  ],
  formations: [],
  competences: ['JavaScript', 'React', 'Pilotage de budgets de 10M€'], // dernière = exagérée, absente
};

(async () => {
  const profil = lireProfil();
  const releve = await relire(profil, brouillon, 'fr');

  const texte = JSON.stringify(releve.cv);
  assert.ok(!texte.includes('Google'), 'Le fait inventé (Google) devrait être retiré du CV');
  assert.ok(!texte.includes('10M€'), 'La compétence exagérée (10M€) devrait être retirée');
  assert.ok(Array.isArray(releve.corrections) && releve.corrections.length > 0,
    'La liste des corrections ne devrait pas être vide');
  assert.ok(texte.includes('3 ans 2 mois'), 'La durée calculée doit être préservée telle quelle');

  console.log('OK — corrections appliquées :');
  for (const c of releve.corrections) console.log('  -', c);
})().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
