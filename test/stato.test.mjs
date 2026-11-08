// Test di stato.mjs: node --test test/stato.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { leggiRegistro, calcolaStato } from '../plugins/checklist/checklist/modelli/stato.mjs';

// I test non dipendono dalla configurazione git di chi li lancia.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

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
  const { voci, errori } = leggiRegistro('\uFEFFlavori:\r\n- id: a\r\n  titolo: Uno\r\n');
  assert.deepEqual(errori, []);
  assert.deepEqual(voci, [{ id: 'a', titolo: 'Uno' }]);
});

test('registro svuotato: nessuna voce, nessun errore', () => {
  assert.deepEqual(leggiRegistro(''), { voci: [], errori: [] });
  assert.deepEqual(leggiRegistro('# solo commenti\n\nlavori:\n  # niente\n'), { voci: [], errori: [] });
});

test('inizio registro: lavori: []', () => {
  assert.deepEqual(leggiRegistro('lavori: []\n'), { voci: [], errori: [] });
});

test('inizio registro: lavori: con un commento dopo', () => {
  assert.deepEqual(leggiRegistro('lavori: # commento\n  - id: a\n'), { voci: [{ id: 'a' }], errori: [] });
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

const GIT = ['-c', 'user.name=prova', '-c', 'user.email=prova@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];
const git = (cwd, ...args) => execFileSync('git', [...GIT, ...args], { cwd, stdio: 'ignore' });

function progetto(registro) {
  const radice = fs.mkdtempSync(path.join(os.tmpdir(), 'checklist prova '));
  if (registro !== undefined) {
    fs.mkdirSync(path.join(radice, 'documenti'));
    fs.writeFileSync(path.join(radice, 'documenti', 'lavori.yaml'), registro);
  }
  return radice;
}

test('registro mancante', () => {
  const s = calcolaStato(progetto());
  assert.deepEqual(s.lavori, []);
  assert.equal(s.lavori_errore, 'documenti/lavori.yaml non trovato');
  assert.equal(s.lavori_modificato, null);
  assert.equal(s.prossimo_passo, null);
  assert.deepEqual(s.riepilogo, { lavori_totali: 0, lavori_aperti: 0, lavori_in_attesa_dell_utente: 0, lavori_in_attesa_di_esterni: 0, lavori_fatti: 0 });
});

test('registro non leggibile', () => {
  const radice = progetto();
  fs.mkdirSync(path.join(radice, 'documenti', 'lavori.yaml'), { recursive: true });
  const s = calcolaStato(radice);
  assert.match(s.lavori_errore, /^documenti\/lavori\.yaml non leggibile: /);
  assert.deepEqual(s.lavori, []);
  assert.equal(s.lavori_modificato, null);
});

test('normalizzazione: default, date, campi sconosciuti', () => {
  const s = calcolaStato(progetto('lavori:\n  - id: a\n    concordato: 2026-11-08T10:00\n    extra: via\n'));
  assert.deepEqual(s.lavori, [{ id: 'a', titolo: '', gruppo: 'Altro', stato: 'da_fare', chi: '', concordato: '2026-11-08', fatto: null, note: null, fonte: null, riquadro: 'da_fare' }]);
  assert.equal(s.lavori_errore, null);
  assert.match(s.lavori_modificato, /^\d{4}-\d{2}-\d{2}T/);
});

test('riquadri, prossimo passo e contatori', () => {
  const voci = [['f', 'fatto', 'utente'], ['r', 'rinviato', 'utente'], ['c1', 'in_corso', 'Claude'], ['c2', 'in_attesa', 'Claude'], ['d', 'da_fare', 'Claude'], ['x', 'strano', 'Claude'], ['u1', 'da_fare', 'Utente'], ['u2', 'in_corso', 'utente'], ['e', 'in_attesa', 'esterni']];
  const s = calcolaStato(progetto('lavori:\n' + voci.map(([id, stato, chi]) => `  - id: ${id}\n    stato: ${stato}\n    chi: ${chi}\n`).join('')));
  assert.deepEqual(s.lavori.map((l) => [l.id, l.riquadro]), [['f', null], ['r', null], ['c1', 'in_corso'], ['c2', 'in_corso'], ['d', 'da_fare'], ['x', 'da_fare'], ['u1', 'utente'], ['u2', 'utente'], ['e', 'esterni']]);
  assert.equal(s.prossimo_passo, 'u1');
  assert.deepEqual(s.riepilogo, { lavori_totali: 9, lavori_aperti: 7, lavori_in_attesa_dell_utente: 2, lavori_in_attesa_di_esterni: 1, lavori_fatti: 1 });
});

test('righe non capite in lavori_errore', () => {
  const s = calcolaStato(progetto('lavori:\n  - id: a\n    note: |\n      continua\n'));
  assert.equal(s.lavori_errore, 'documenti/lavori.yaml: riga 3 non capita: «    note: |»; riga 4 non capita: «      continua»');
  assert.equal(s.lavori.length, 1);
});

test('più di 5 righe non capite: ne elenca 5 e conta le altre', () => {
  const s = calcolaStato(progetto('lavori:\n' + [1, 2, 3, 4, 5, 6, 7].map((n) => `x${n}\n`).join('')));
  assert.equal(s.lavori_errore, 'documenti/lavori.yaml: riga 2 non capita: «x1»; riga 3 non capita: «x2»; riga 4 non capita: «x3»; riga 5 non capita: «x4»; riga 6 non capita: «x5»; e altre 2 righe non capite');
});

test('git: senza repo tutto a null o 0', () => {
  assert.deepEqual(calcolaStato(progetto('lavori:\n')).archivio, { ultimo_salvataggio: null, file_modificati: 0, salvataggi_da_inviare: null, salvataggi_da_ricevere: null });
});

test('git: repo senza commit', () => {
  const radice = progetto('lavori:\n');
  git(radice, 'init', '-q');
  assert.deepEqual(calcolaStato(radice).archivio, { ultimo_salvataggio: null, file_modificati: 1, salvataggi_da_inviare: null, salvataggi_da_ricevere: null });
});

test('git: messaggio con | intero, file modificati, niente upstream', () => {
  const radice = progetto('lavori:\n');
  git(radice, 'init', '-q');
  git(radice, 'add', '.');
  git(radice, 'commit', '-q', '-m', 'a | b');
  fs.writeFileSync(path.join(radice, 'nuovo.txt'), 'x');
  const { archivio } = calcolaStato(radice);
  assert.match(archivio.ultimo_salvataggio.hash, /^[0-9a-f]{7,}$/);
  assert.match(archivio.ultimo_salvataggio.data, /^\d{4}-\d{2}-\d{2} /);
  assert.equal(archivio.ultimo_salvataggio.messaggio, 'a | b');
  assert.equal(archivio.file_modificati, 1);
  assert.equal(archivio.salvataggi_da_inviare, null);
  assert.equal(archivio.salvataggi_da_ricevere, null);
});

test('lancio da riga di comando, anche da un percorso con link simbolico e spazi', () => {
  const vera = progetto('lavori:\n  - id: a\n');
  const cartella = path.join(vera, 'strumenti-locali', 'avanzamento');
  fs.mkdirSync(cartella, { recursive: true });
  fs.copyFileSync(path.join(MODELLI, 'stato.mjs'), path.join(cartella, 'stato.mjs'));
  const link = `${vera} link`;
  fs.symlinkSync(vera, link);
  const out = execFileSync(process.execPath, [path.join(link, 'strumenti-locali', 'avanzamento', 'stato.mjs')], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).lavori[0].id, 'a');
});

test('importato non stampa nulla', () => {
  const url = pathToFileURL(path.join(MODELLI, 'stato.mjs')).href;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`], { encoding: 'utf8' });
  assert.equal(out, '');
});
