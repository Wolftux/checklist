---
name: checklist
description: Checklist di avanzamento in chat per qualunque progetto. Installa ciò che manca (registro documenti/lavori.yaml, script strumenti-locali/avanzamento/stato.mjs, regola nel CLAUDE.md, righe in .git/info/exclude) e apre la chat «Checklist: nome del progetto» con il widget. Usa quando l'utente scrive /checklist o chiede di installare la checklist in un progetto. Per mostrare la checklist in un progetto che ce l'ha già basta la regola del suo CLAUDE.md.
---

# /checklist: la checklist di avanzamento nel progetto

/checklist installa nella cartella corrente ciò che manca per la checklist, poi la mostra in una chat dedicata. Non sovrascrive e non cambia nulla di ciò che c'è già.

Come lavori:
- La cartella del progetto è la cartella corrente. Tutti i comandi partono da lì.
- `<base>` è la «Base directory» stampata in cima a questa skill. I modelli sono in `<base>/modelli/`.
- Ogni percorso nei comandi va tra virgolette: la base e la cartella del progetto possono contenere spazi.
- Esegui i passi in ordine, senza chiedere conferme, salvo dove il passo lo dice.
- Ogni `grep` usa `-a`: in Claude Code `grep` può trattare come binario un file non UTF-8 e non trovare righe che ci sono.

## Passo 1: controlli preliminari

1. Esegui `command -v node`. Se non stampa nulla, scrivi una riga («Serve Node.js 18 o successivo: installalo e rilancia /checklist») e fermati.
2. Esegui `git rev-parse --path-format=absolute --git-dir` e `git rev-parse --path-format=absolute --git-common-dir`. Se danno due risultati diversi, sei in un worktree secondario: scrivi una riga («Sei in un worktree: il registro sparirebbe con lui. Lancia /checklist dalla cartella principale del progetto») e fermati. Se entrambi i comandi falliscono, non c'è git: vai avanti.
3. Esegui `pwd -P` e `(cd ~ && pwd -P)`. Se danno lo stesso risultato, sei nella cartella home: scrivi una riga («Sei nella cartella home: il blocco nel CLAUDE.md varrebbe per tutti i progetti. Lancia /checklist nella cartella del progetto») e fermati.

Il passo è finito quando node c'è e la cartella non è né un worktree secondario né la cartella home.

## Passo 2: controllo dei quattro pezzi

Non scrivere nulla. Annota per ciascuno se c'è o manca:
- il registro: esiste `documenti/lavori.yaml`;
- lo script: esiste `strumenti-locali/avanzamento/stato.mjs`;
- il blocco: `grep -aqx '## Checklist di avanzamento' CLAUDE.md` riesce (se `CLAUDE.md` non esiste, il blocco manca);
- le righe di esclusione, solo con git (`git rev-parse --is-inside-work-tree` stampa `true`): il file stampato da `git rev-parse --git-path info/exclude` contiene le righe esatte `**/documenti/lavori.yaml` e `**/strumenti-locali/avanzamento/`. Sono solo i file della skill: le altre cartelle `documenti/` del progetto restano visibili a git. Controlla ciascuna con `grep -aqxF '**/documenti/lavori.yaml' "<file exclude>"` e `grep -aqxF '**/strumenti-locali/avanzamento/' "<file exclude>"`. Se il file non esiste, mancano entrambe.

Il passo è finito quando sai quali pezzi mancano.

## Passo 3: nome del progetto

1. Se il blocco c'è nel `CLAUDE.md`, il nome è ciò che segue «Aggiorna la checklist di » fino alla virgoletta di chiusura `»`, alla prima occorrenza. Comando: `grep -ao 'Aggiorna la checklist di [^»]*' CLAUDE.md | head -1`, senza il prefisso. Se il nome c'è, non fare domande. Se il comando non stampa nulla o il nome resta vuoto (riga modificata dall'utente), passa al punto 2.
2. Altrimenti fai una domanda con AskUserQuestion. Prima opzione, consigliata: il nome della cartella. Seconda opzione: una variante, cioè il titolo `# ` del README se c'è ed è diverso dal nome della cartella, altrimenti il nome della cartella con maiuscole o spazi diversi. L'utente può sempre scrivere un altro nome.
3. Se non puoi fare domande (per esempio in modalità non interattiva), usa il nome della cartella e scrivi una riga che lo dice.

Il passo è finito quando hai il nome, che qui sotto si chiama `<PROGETTO>`.

## Passo 4: installazione di ciò che manca

Fai solo ciò che il passo 2 ha trovato mancante. Mai sovrascrivere né modificare ciò che c'è.

1. **Registro.** Se manca: `mkdir -p documenti` e `[ -e documenti/lavori.yaml ] || sed "s/<OGGI>/$(date +%F)/g" "<base>/modelli/lavori.yaml" > documenti/lavori.yaml` (la guardia protegge un registro esistente anche se il passo 2 ha sbagliato).
   Se però lo script c'è già, il progetto può avere una checklist sua che legge un altro registro (per esempio `lavori.json`): prima chiedi con AskUserQuestion se creare `documenti/lavori.yaml`. Prima opzione, consigliata: non crearlo. Se la risposta è no, o se non puoi fare domande, non crearlo, scrivi una riga che lo dice e salta anche le righe di esclusione (punto 4), che nasconderebbero a git i file della checklist del progetto.
2. **Script.** Se manca: `mkdir -p strumenti-locali/avanzamento` e `cp -n "<base>/modelli/stato.mjs" strumenti-locali/avanzamento/stato.mjs`.
3. **Blocco nel CLAUDE.md.** Se manca:
   - leggi `<base>/modelli/claude-md.md` e sostituisci ogni `<PROGETTO>` con il nome;
   - esegui `mktemp -d` e scrivi il blocco già sostituito, con lo strumento di scrittura di file, in `<tmp>/blocco.md` (`<tmp>` è la cartella stampata);
   - se `CLAUDE.md` esiste e non è vuoto, prepara la coda con questi due comandi (non leggere né riscrivere il file):
     `if [ -s CLAUDE.md ] && [ -n "$(tail -c1 CLAUDE.md)" ]; then printf '\n' >> CLAUDE.md; fi` (aggiunge l'a capo finale se manca)
     `if [ -s CLAUDE.md ] && [ -n "$(tail -n1 CLAUDE.md)" ]; then printf '\n' >> CLAUDE.md; fi` (aggiunge la riga vuota se l'ultima riga non è vuota)
   - accoda il blocco: `cat "<tmp>/blocco.md" >> CLAUDE.md` (crea il file se non esiste). Il testo dell'utente non si riscrive mai.
   - Non usare `sed`: il nome può contenere `/` o `&`.
4. **Righe di esclusione**, solo con git. Sia `<exclude>` il percorso stampato da `git rev-parse --git-path info/exclude`.
   - `mkdir -p "$(dirname "<exclude>")"`.
   - Aggiungi l'a capo finale se manca: `if [ -s "<exclude>" ] && [ -n "$(tail -c1 "<exclude>")" ]; then printf '\n' >> "<exclude>"; fi`.
   - Per ciascuna riga che manca tra `**/documenti/lavori.yaml` e `**/strumenti-locali/avanzamento/`: `printf '%s\n' '**/documenti/lavori.yaml' >> "<exclude>"` (o `'**/strumenti-locali/avanzamento/'`).
5. **Senza git**, scrivi una riga di avviso: «Qui non c'è git: la riga del repo nel widget resterà vuota».

Il passo è finito quando ogni pezzo mancante è stato creato. Se non mancava nulla, il passo è finito subito.

## Passo 5: apertura della chat della checklist

Fallo sia dopo un'installazione sia quando c'era già tutto.

1. Se `mcp__ccd_session__start_session` e `mcp__ccd_session_mgmt__detach_session` sono tra gli strumenti differiti, caricali con ToolSearch.
2. Chiama `start_session` con:
   - `initiation`: `user_asked`
   - `context`: `fresh`
   - `use_worktree`: `false`
   - `effort`: `low` (la chat esegue uno script e compone un widget: non serve lo sforzo della sessione da cui parte)
   - `title`: «Checklist: <PROGETTO>»
   - `prompt`: «Esegui `node strumenti-locali/avanzamento/stato.mjs` e mostra la checklist come dice il CLAUDE.md»
   - `background`: «Checklist di avanzamento del progetto <PROGETTO>: lo script è `strumenti-locali/avanzamento/stato.mjs`. Il CLAUDE.md del progetto dice qual è il registro, come mostrare la checklist e quando aggiornare il registro.»
3. Subito dopo chiama `detach_session` con l'id restituito: è una chat principale, non una sottochat.
4. Se `start_session` manca (CLI) o rifiuta: esegui `node strumenti-locali/avanzamento/stato.mjs` e mostra la checklist in questa chat, come dice `<base>/modelli/claude-md.md`: con `show_widget`, oppure in tabella markdown se `show_widget` manca.
5. Se `start_session` riesce ma lo stacco manca o rifiuta, scrivi una riga: «Staccala dalla barra laterale con Detach to top level».
6. Ogni lancio apre una chat nuova: non cercare chat precedenti.

Il passo è finito quando la chat è aperta e staccata, oppure la checklist è stata mostrata in questa chat.

## Passo 6: messaggio finale

Scrivi due o tre righe:
- cosa hai aggiunto, oppure «C'era già tutto»;
- gli avvisi, se ce ne sono;
- dove trovare la chat della checklist.

Scrivi anche che per aggiungere o chiudere lavori basta dirlo in chat: la regola nel CLAUDE.md fa aggiornare il registro.

Il passo è finito quando il messaggio è scritto.
