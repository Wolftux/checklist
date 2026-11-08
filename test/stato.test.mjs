// Test di stato.mjs: node --test test/stato.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiRegistro } from '../plugins/checklist/checklist/modelli/stato.mjs';

const MODELLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'checklist', 'checklist', 'modelli');

test('il modello lavori.yaml dà una voce e zero errori', () => {
  const { voci, errori } = leggiRegistro(fs.readFileSync(path.join(MODELLI, 'lavori.yaml'), 'utf8'));
  assert.deepEqual(errori, []);
  assert.deepEqual(voci, [{ id: 'checklist', titolo: 'Installata la checklist di avanzamento', gruppo: 'Checklist', stato: 'fatto', chi: 'Claude', concordato: '<OGGI>', fatto: '<OGGI>', fonte: '/checklist' }]);
});

test('valori: due punti, #, virgolette, vuoti', () => {
  const { voci, errori } = leggiRegistro([
    'lavori:',
    '  - id: a',
    '    titolo: Nota: con i due punti',
    '    note: PR #1206 su X',
    '  - id: b',
    '    titolo: "Dice \\"ciao\\" e \\\\ basta"',
    "    note: 'it''s'",
    '    fonte:',
  ].join('\n'));
  assert.deepEqual(errori, []);
  assert.deepEqual(voci, [
    { id: 'a', titolo: 'Nota: con i due punti', note: 'PR #1206 su X' },
    { id: 'b', titolo: 'Dice "ciao" e \\ basta', note: "it's", fonte: null },
  ]);
});

test('fine riga Windows, BOM e trattino a colonna 0', () => {
  const { voci, errori } = leggiRegistro('﻿lavori:\r\n- id: a\r\n  titolo: Uno\r\n');
  assert.deepEqual(errori, []);
  assert.deepEqual(voci, [{ id: 'a', titolo: 'Uno' }]);
});

test('registro svuotato: nessuna voce, nessun errore', () => {
  assert.deepEqual(leggiRegistro(''), { voci: [], errori: [] });
  assert.deepEqual(leggiRegistro('# solo commenti\n\nlavori:\n  # niente\n'), { voci: [], errori: [] });
});

test("chiave ripetuta: vale l'ultima", () => {
  assert.equal(leggiRegistro('lavori:\n  - id: a\n    stato: da_fare\n    stato: fatto\n').voci[0].stato, 'fatto');
});

test('righe non capite: numero e testo, le altre voci si leggono', () => {
  const righe = [
    'progetto: X',        // 1 prima di lavori:
    'lavori:',            // 2
    '    titolo: orfano', // 3 campo prima della prima voce
    '  - id: a',          // 4
    '    note: |',        // 5 valore su più righe
    '      continua',     // 6 rientro sbagliato
    '    tag:',           // 7 valido, valore vuoto
    '      - x',          // 8 lista annidata
    '      - nome: y',    // 9 trattino a un'altra colonna
    '  -',                // 10 trattino senza chiave
    'altro: Z',           // 11 chiave a colonna 0 dopo lavori:
    '  - id: b',          // 12
    '    titolo: Due',    // 13
    '    fonte:x',        // 14 manca lo spazio dopo i due punti
  ];
  const { voci, errori } = leggiRegistro(righe.join('\n'));
  assert.deepEqual(errori.map((e) => e.riga), [1, 3, 5, 6, 8, 9, 10, 11, 14]);
  assert.deepEqual(errori[2], { riga: 5, testo: '    note: |' });
  assert.deepEqual(voci, [{ id: 'a', tag: null }, { id: 'b', titolo: 'Due' }]);
});
