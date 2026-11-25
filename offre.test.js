const assert = require('node:assert');
const { htmlVersTexte } = require('./server');

// Supprime script/style et leur contenu, enlève les balises, décode les entités.
const html = `
  <html><head><style>body{color:red}</style></head>
  <body>
    <script>var x = 1;</script>
    <h1>Développeur&nbsp;Node</h1>
    <p>Stack R&amp;D : JS &lt;3 &quot;temps réel&quot; d&#39;équipe</p>
  </body></html>`;

const texte = htmlVersTexte(html);

assert.ok(!/color:red/.test(texte), 'contenu <style> non retiré');
assert.ok(!/var x/.test(texte), 'contenu <script> non retiré');
assert.ok(!/<h1>|<\/p>|<body>/i.test(texte), 'balises non retirées');
assert.ok(texte.includes('Développeur Node'), '&nbsp; non décodé');
assert.ok(texte.includes('R&D'), '&amp; non décodé');
assert.ok(texte.includes('"temps réel"'), '&quot; non décodé');
assert.ok(texte.includes("d'équipe"), '&#39; non décodé');

console.log('offre.test.js OK');
