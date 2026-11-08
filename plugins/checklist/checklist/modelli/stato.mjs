// Legge il registro dei lavori (YAML semplificato): leggiRegistro(testo) -> { voci, errori }.
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
