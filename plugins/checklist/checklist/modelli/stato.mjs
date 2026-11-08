// Legge il registro dei lavori (YAML semplificato) e lo stato di git. Non scrive nessun file.
// Uso: node strumenti-locali/avanzamento/stato.mjs   (stampa il JSON)
// Esporta leggiRegistro(testo) -> { voci, errori } e calcolaStato(radice) -> oggetto JSON.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const IGNORA = /^\s*(#|$)/;
const INIZIO_REGISTRO = /^lavori:\s*$/;
const INIZIO_VOCE = /^(\s*)-(\s+)([A-Za-z_][\w-]*):(?:\s+(.*))?$/;
const CAMPO = /^(\s*)([A-Za-z_][\w-]*):(?:\s+(.*))?$/;
const MULTIRIGA = /^[|>][-+0-9]*$/;

// Toglie le virgolette esterne; un valore vuoto diventa null. Restituisce undefined se il valore è su più righe.
function leggiValore(grezzo = '') {
  const v = grezzo.trim();
  if (MULTIRIGA.test(v)) return undefined;
  let m;
  if ((m = v.match(/^"(.*)"$/))) return m[1].replace(/\\(["\\])/g, '$1');
  if ((m = v.match(/^'(.*)'$/))) return m[1].replace(/''/g, "'");
  return v === '' ? null : v;
}

export function leggiRegistro(testo) {
  const voci = [];
  const errori = [];
  let inRegistro = false;
  let colTrattino = null; // fissata dalla prima voce
  let colCampi = null;
  let corrente = null;

  testo.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((riga, i) => {
    const sbagliata = () => errori.push({ riga: i + 1, testo: riga });
    if (IGNORA.test(riga)) return;
    if (!inRegistro) {
      if (INIZIO_REGISTRO.test(riga)) inRegistro = true;
      else sbagliata();
      return;
    }
    let chiave, grezzo;
    let m = riga.match(INIZIO_VOCE);
    if (m) {
      if (colTrattino === null) colTrattino = m[1].length;
      if (m[1].length !== colTrattino) return sbagliata();
      colCampi = m[1].length + 1 + m[2].length;
      corrente = {};
      voci.push(corrente);
      [chiave, grezzo] = [m[3], m[4]];
    } else if ((m = riga.match(CAMPO)) && corrente && m[1].length === colCampi) {
      [chiave, grezzo] = [m[2], m[3]];
    } else return sbagliata();
    const valore = leggiValore(grezzo);
    if (valore === undefined) sbagliata();
    else corrente[chiave] = valore;
  });
  return { voci, errori };
}

const QUI = path.dirname(fileURLToPath(import.meta.url));
const FILE_REGISTRO = 'documenti/lavori.yaml';

function leggiLavori(radice) {
  const file = path.join(radice, 'documenti', 'lavori.yaml');
  if (!fs.existsSync(file)) return { lavori: [], errore: `${FILE_REGISTRO} non trovato`, modificato: null };
  let voci, errori;
  try {
    ({ voci, errori } = leggiRegistro(fs.readFileSync(file, 'utf8')));
  } catch (e) {
    return { lavori: [], errore: `${FILE_REGISTRO} non leggibile: ${e.message}`, modificato: null };
  }
  const lavori = voci.map((l) => {
    const data = (v) => (v ? String(v).slice(0, 10) : null);
    const v = {
      id: String(l.id ?? ''),
      titolo: String(l.titolo ?? ''),
      gruppo: l.gruppo ?? 'Altro',
      stato: l.stato ?? 'da_fare',
      chi: l.chi ?? '',
      concordato: data(l.concordato),
      fatto: data(l.fatto),
      note: l.note ?? null,
      fonte: l.fonte ?? null,
    };
    const chi = v.chi.toLowerCase();
    v.riquadro = ['fatto', 'rinviato'].includes(v.stato) ? null
      : chi === 'utente' || chi === 'esterni' ? chi
      : ['in_corso', 'in_attesa'].includes(v.stato) ? 'in_corso' : 'da_fare';
    return v;
  });
  return {
    lavori,
    errore: errori.length ? `${FILE_REGISTRO}: ` + errori.map((e) => `riga ${e.riga} non capita: «${e.testo}»`).join('; ') : null,
    modificato: fs.statSync(file).mtime.toISOString(),
  };
}

function git(radice, args) {
  try {
    return execFileSync('git', args, { cwd: radice, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

function statoArchivio(radice) {
  const ultimo = git(radice, ['log', '-1', '--format=%h|%ci|%s']);
  const [hash, data, ...resto] = ultimo ? ultimo.split('|') : [];
  const modifiche = git(radice, ['status', '--porcelain']);
  const daInviare = git(radice, ['rev-list', '--count', '@{upstream}..HEAD']);
  const daRicevere = git(radice, ['rev-list', '--count', 'HEAD..@{upstream}']);
  return {
    ultimo_salvataggio: hash ? { hash, data, messaggio: resto.join('|') } : null,
    file_modificati: modifiche ? modifiche.split('\n').filter(Boolean).length : 0,
    salvataggi_da_inviare: daInviare == null ? null : Number(daInviare),
    salvataggi_da_ricevere: daRicevere == null ? null : Number(daRicevere),
  };
}

// radice: cartella del progetto, di default due sopra lo script.
export function calcolaStato(radice = path.resolve(QUI, '..', '..')) {
  const { lavori, errore, modificato } = leggiLavori(radice);
  const aperti = lavori.filter((l) => l.riquadro !== null);
  return {
    calcolato: new Date().toISOString(),
    riepilogo: {
      lavori_totali: lavori.length,
      lavori_aperti: aperti.length,
      lavori_in_attesa_dell_utente: aperti.filter((l) => l.riquadro === 'utente').length,
      lavori_in_attesa_di_esterni: aperti.filter((l) => l.riquadro === 'esterni').length,
      lavori_fatti: lavori.filter((l) => l.stato === 'fatto').length,
    },
    prossimo_passo: lavori.find((l) => l.riquadro === 'utente')?.id ?? null,
    lavori,
    lavori_errore: errore,
    lavori_modificato: modificato,
    archivio: statoArchivio(radice),
  };
}

// Stampa solo se lanciato direttamente (realpath: il percorso può passare da link simbolici).
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(calcolaStato(), null, 2)}\n`);
}
