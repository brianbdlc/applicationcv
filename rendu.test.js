const assert = require('node:assert');
const { genererDocx, genererPdf, construireElements } = require('./rendu');

const cv = {
  identite: { nom: 'Jean Dupont', titre: 'Développeur', email: 'jean@ex.fr', telephone: '0600', lieu: 'Paris' },
  resume: 'Développeur full-stack.',
  experiences: [{ poste: 'Dev', entreprise: 'ACME', lieu: 'Paris', periode: '2020 – présent', duree: '4 ans', realisations: ['A fait X', 'A fait Y'] }],
  formations: [{ diplome: 'Master Info', etablissement: 'Univ', periode: '2018 – 2020' }],
  competences: ['JS', 'Node'],
  langues: [{ langue: 'Français', niveau: 'natif' }],
  benevolats: ['Mentorat de débutants'],
  interets: ['Course à pied'],
};
cv.identite.linkedin = 'https://linkedin.com/in/jean';

(async () => {
  // Les éléments suivent l'ordre de l'écran : titre → contact → sections.
  const el = construireElements(cv, 'fr');
  assert.strictEqual(el[0].type, 'titre');
  assert.ok(el.some((e) => e.type === 'contact' && e.texte.includes('linkedin.com')));
  assert.ok(el.some((e) => e.type === 'label' && e.label === 'Résumé'));
  assert.ok(el.some((e) => e.type === 'puce' && e.texte === 'A fait X'));
  assert.ok(el.some((e) => e.type === 'section' && e.texte === 'Bénévolats'));
  assert.ok(el.some((e) => e.type === 'label' && e.label === 'Intérêts'));

  const docx = await genererDocx(cv, 'fr');
  assert.ok(Buffer.isBuffer(docx) && docx.length > 0, 'docx vide');
  assert.strictEqual(docx.slice(0, 2).toString('latin1'), 'PK', 'docx pas un zip'); // signature zip

  const pdf = await genererPdf(cv, 'fr');
  assert.ok(Buffer.isBuffer(pdf) && pdf.length > 0, 'pdf vide');
  assert.strictEqual(pdf.slice(0, 4).toString('latin1'), '%PDF', 'pdf pas un PDF');

  console.log('rendu.test.js OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
