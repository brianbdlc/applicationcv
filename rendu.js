// Rend l'objet CV validé (même shape que celui affiché à l'écran) en .docx et .pdf.
// Une seule colonne, sections identiques à l'écran, sans tableau/image/icône (ATS).
// Source unique → deux rendus, pour garantir un .docx et un .pdf au contenu identique.

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} = require('docx');
const PDFDocument = require('pdfkit');

const LIBELLES = {
  fr: { titrePoste: 'Titre du poste', resume: 'Résumé', exp: 'Expériences', benevolats: 'Bénévolats', form: 'Formations', comp: 'Compétences', lang: 'Langues', interets: 'Intérêts' },
  en: { titrePoste: 'Target role', resume: 'Summary', exp: 'Experience', benevolats: 'Volunteering', form: 'Education', comp: 'Skills', lang: 'Languages', interets: 'Interests' },
};

// Formatte les faits du CV en lignes neutres, dans le même ordre que remplirCv (index.html).
// Renvoie une liste d'éléments { type, texte } consommée par chaque rendu.
function construireElements(cv, langue) {
  const L = LIBELLES[langue] || LIBELLES.fr;
  const id = cv.identite || {};
  const el = [];

  if (id.nom) el.push({ type: 'titre', texte: id.nom });
  const contact = [id.email, id.telephone, id.linkedin, id.lieu].filter(Boolean).join('  |  ');
  if (contact) el.push({ type: 'contact', texte: contact });

  if (id.titre) el.push({ type: 'label', label: L.titrePoste, texte: id.titre });
  if (cv.resume) el.push({ type: 'label', label: L.resume, texte: cv.resume });

  if ((cv.experiences || []).length) {
    el.push({ type: 'section', texte: L.exp });
    for (const exp of cv.experiences) {
      el.push({ type: 'entree', texte: [exp.poste, exp.entreprise].filter(Boolean).join(' — ') });
      const duree = exp.duree ? ` (${exp.duree})` : '';
      const meta = [exp.lieu, exp.periode ? exp.periode + duree : ''].filter(Boolean).join(' · ');
      if (meta) el.push({ type: 'meta', texte: meta });
      for (const r of exp.realisations || []) el.push({ type: 'puce', texte: r });
    }
  }

  if ((cv.benevolats || []).length) {
    el.push({ type: 'section', texte: L.benevolats });
    for (const b of cv.benevolats) el.push({ type: 'puce', texte: b });
  }

  if ((cv.formations || []).length) {
    el.push({ type: 'section', texte: L.form });
    for (const f of cv.formations) {
      el.push({ type: 'entree', texte: f.diplome || '' });
      const meta = [f.etablissement, f.periode].filter(Boolean).join(' · ');
      if (meta) el.push({ type: 'meta', texte: meta });
    }
  }

  if ((cv.competences || []).length) {
    el.push({ type: 'section', texte: L.comp });
    el.push({ type: 'paragraphe', texte: cv.competences.join('  |  ') });
  }

  if ((cv.langues || []).length) {
    el.push({ type: 'label', label: L.lang, texte: cv.langues.map((l) => `${l.langue} (${l.niveau})`).join('  |  ') });
  }

  if ((cv.interets || []).length) {
    el.push({ type: 'label', label: L.interets, texte: cv.interets.join('  |  ') });
  }

  return el;
}

function genererDocx(cv, langue) {
  const children = [];
  for (const e of construireElements(cv, langue)) {
    switch (e.type) {
      case 'titre':
        children.push(new Paragraph({ text: e.texte, heading: HeadingLevel.TITLE }));
        break;
      case 'label':
        children.push(new Paragraph({ children: [
          new TextRun({ text: `${e.label} : `, bold: true }),
          new TextRun({ text: e.texte }),
        ] }));
        break;
      case 'section':
        children.push(new Paragraph({ text: e.texte, heading: HeadingLevel.HEADING_1, thematicBreak: true }));
        break;
      case 'entree':
        children.push(new Paragraph({ children: [new TextRun({ text: e.texte, bold: true })] }));
        break;
      case 'puce':
        children.push(new Paragraph({ text: e.texte, bullet: { level: 0 } }));
        break;
      default: // contact, meta, paragraphe
        children.push(new Paragraph({ text: e.texte }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc); // Promise<Buffer>
}

function genererPdf(cv, langue) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const e of construireElements(cv, langue)) {
      switch (e.type) {
        case 'titre':
          doc.font('Helvetica-Bold').fontSize(20).text(e.texte);
          break;
        case 'contact':
          doc.font('Helvetica').fontSize(10).text(e.texte).moveDown(0.5);
          break;
        case 'label':
          doc.fontSize(10).font('Helvetica-Bold').text(`${e.label} : `, { continued: true })
            .font('Helvetica').text(e.texte);
          doc.moveDown(0.25);
          break;
        case 'section':
          doc.moveDown(0.5).font('Helvetica-Bold').fontSize(13).text(e.texte).moveDown(0.25);
          break;
        case 'entree':
          doc.font('Helvetica-Bold').fontSize(11).text(e.texte);
          break;
        case 'meta':
          doc.font('Helvetica').fontSize(9).fillColor('#555555').text(e.texte).fillColor('#000000');
          break;
        case 'puce':
          doc.font('Helvetica').fontSize(10).list([e.texte], { bulletRadius: 1.5, textIndent: 12 });
          break;
        default: // paragraphe
          doc.font('Helvetica').fontSize(10).text(e.texte);
      }
    }
    doc.end();
  });
}

module.exports = { genererDocx, genererPdf, construireElements };
