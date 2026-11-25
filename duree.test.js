const assert = require('node:assert');
const { moisEntre, formaterDuree } = require('./duree');

// moisEntre : bornes fixes
assert.strictEqual(moisEntre('2019-03', '2021-08'), 29); // 2 ans 5 mois
assert.strictEqual(moisEntre('2016-09', '2018-09'), 24); // 2 ans pile
assert.strictEqual(moisEntre('2024-01', '2024-09'), 8);  // < 1 an

// moisEntre : "present" / absent → >= 0 et croît avec le temps
assert.ok(moisEntre('2021-09', 'present') >= 0);
assert.ok(moisEntre('2021-09') >= 0);

// formaterDuree fr
assert.strictEqual(formaterDuree(50, 'fr'), '4 ans 2 mois');
assert.strictEqual(formaterDuree(24, 'fr'), '2 ans');
assert.strictEqual(formaterDuree(12, 'fr'), '1 an');
assert.strictEqual(formaterDuree(13, 'fr'), '1 an 1 mois');
assert.strictEqual(formaterDuree(8, 'fr'), '8 mois');
assert.strictEqual(formaterDuree(0, 'fr'), '0 mois');

// formaterDuree en
assert.strictEqual(formaterDuree(50, 'en'), '4 years 2 months');
assert.strictEqual(formaterDuree(12, 'en'), '1 year');
assert.strictEqual(formaterDuree(13, 'en'), '1 year 1 month');
assert.strictEqual(formaterDuree(8, 'en'), '8 months');

console.log('duree.test.js OK');
