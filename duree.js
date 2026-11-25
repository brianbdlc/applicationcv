// Calcul des durées d'expérience en JS (jamais rédigées par le LLM).
// Dates au format "YYYY-MM" ; fin "present" (ou absente) = aujourd'hui.

function moisEntre(debut, fin) {
  const [ad, md] = debut.split('-').map(Number);
  let af, mf;
  if (!fin || fin === 'present') {
    const now = new Date();
    af = now.getFullYear();
    mf = now.getMonth() + 1;
  } else {
    [af, mf] = fin.split('-').map(Number);
  }
  return (af - ad) * 12 + (mf - md);
}

function formaterDuree(mois, langue) {
  if (mois < 0) mois = 0;
  const ans = Math.floor(mois / 12);
  const m = mois % 12;
  const en = langue === 'en';
  const parts = [];
  if (ans > 0) {
    if (en) parts.push(`${ans} ${ans === 1 ? 'year' : 'years'}`);
    else parts.push(`${ans} an${ans === 1 ? '' : 's'}`);
  }
  if (m > 0 || ans === 0) {
    if (en) parts.push(`${m} ${m === 1 ? 'month' : 'months'}`);
    else parts.push(`${m} mois`);
  }
  return parts.join(' ');
}

module.exports = { moisEntre, formaterDuree };
