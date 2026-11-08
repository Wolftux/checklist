---
name: checklist
description: Checklist di avanzamento in chat per qualunque progetto. Installa ciò che manca (registro documenti/lavori.yaml, script strumenti-locali/avanzamento/stato.mjs, regola nel CLAUDE.md, righe in .git/info/exclude) e apre la chat «Checklist: <progetto>» con il widget. Usa quando l'utente scrive /checklist o chiede di installare la checklist in un progetto. Per mostrare la checklist in un progetto che ce l'ha già basta la regola del suo CLAUDE.md.
---

# /checklist: la checklist di avanzamento nel progetto

/checklist installa nella cartella corrente ciò che manca per la checklist, poi la mostra in una chat dedicata. Non sovrascrive e non cambia nulla di ciò che c'è già.

Come lavori:
- La cartella del progetto è la cartella corrente. Tutti i comandi partono da lì.
- `<base>` è la «Base directory» stampata in cima a questa skill. I modelli sono in `<base>/modelli/`.
- Ogni percorso nei comandi va tra virgolette: la base e la cartella del progetto possono contenere spazi.
- Esegui i passi in ordine, senza chiedere conferme, salvo dove il passo lo dice.

## Passo 1: controlli preliminari

1. Esegui `command -v node`. Se non stampa nulla, scrivi una riga («Serve Node.js 18 o successivo: installalo e rilancia /checklist») e fermati.
2. Esegui `git rev-parse --path-format=absolute --git-dir` e `git rev-parse --path-format=absolute --git-common-dir`. Se danno due risultati diversi, sei in un worktree secondario: scrivi una riga («Sei in un worktree: il registro sparirebbe con lui. Lancia /checklist dalla cartella principale del progetto») e fermati. Se entrambi i comandi falliscono, non c'è git: vai avanti.

Il passo è finito quando node c'è e la cartella non è un worktree secondario.

## Passo 2: controllo dei quattro pezzi

Non scrivere nulla. Annota per ciascuno se c'è o manca:
- il registro: esiste `documenti/lavori.yaml`;
- lo script: esiste `strumenti-locali/avanzamento/stato.mjs`;
- il blocco: `grep -qx '## Checklist di avanzamento' CLAUDE.md` riesce (se `CLAUDE.md` non esiste, il blocco manca);
- le righe di esclusione, solo con git (`git rev-parse --is-inside-work-tree` stampa `true`): il file stampato da `git rev-parse --git-path info/exclude` contiene le righe esatte `documenti/` e `strumenti-locali/`. Controlla ciascuna con `grep -qxF 'documenti/' "<file exclude>"`. Se il file non esiste, mancano entrambe.

Il passo è finito quando sai quali pezzi mancano.

## Passo 3: nome del progetto

1. Se il blocco c'è nel `CLAUDE.md`, il nome è ciò che segue «Aggiorna la checklist di » fino alla virgoletta di chiusura `»`, alla prima occorrenza. Comando: `grep -o 'Aggiorna la checklist di [^»]*' CLAUDE.md | head -1`, senza il prefisso. Non fare domande.
2. Altrimenti fai una domanda con AskUserQuestion. Prima opzione, consigliata: il nome della cartella. Seconda opzione: una variante, cioè il titolo `# ` del README se c'è ed è diverso dal nome della cartella, altrimenti il nome della cartella con maiuscole o spazi diversi. L'utente può sempre scrivere un altro nome.
3. Se non puoi fare domande (per esempio in modalità non interattiva), usa il nome della cartella e scrivi una riga che lo dice.

Il passo è finito quando hai il nome, che qui sotto si chiama `<PROGETTO>`.

## Passo 4: installazione di ciò che manca

Fai solo ciò che il passo 2 ha trovato mancante. Mai sovrascrivere né modificare ciò che c'è.

1. **Registro.** Se manca: `mkdir -p documenti` e `sed "s/<OGGI>/$(date +%F)/g" "<base>/modelli/lavori.yaml" > documenti/lavori.yaml`.
2. **Script.** Se manca: `mkdir -p strumenti-locali/avanzamento` e `cp "<base>/modelli/stato.mjs" strumenti-locali/avanzamento/stato.mjs`.
3. **Blocco nel CLAUDE.md.** Se manca:
   - leggi `<base>/modelli/claude-md.md` e sostituisci ogni `<PROGETTO>` con il nome;
   - se `CLAUDE.md` non esiste, crealo con il solo blocco;
   - se esiste, leggilo, poi scrivilo di nuovo con lo strumento di scrittura di file: il testo che c'è, un a capo se non finiva con un a capo, una riga vuota, poi il blocco. Se il testo finiva già con una riga vuota, non aggiungerne un'altra. Controlla l'ultimo byte con `tail -c1 CLAUDE.md`.
   - Non usare `sed`: il nome può contenere `/` o `&`.
4. **Righe di esclusione**, solo con git. Sia `<exclude>` il percorso stampato da `git rev-parse --git-path info/exclude`.
   - `mkdir -p "$(dirname "<exclude>")"`.
   - Se il file esiste, non è vuoto e non finisce con un a capo (`tail -c1`), aggiungi un a capo: `printf '\n' >> "<exclude>"`.
   - Per ciascuna riga che manca tra `documenti/` e `strumenti-locali/`: `printf '%s\n' 'documenti/' >> "<exclude>"` (o `'strumenti-locali/'`).
5. **Senza git**, scrivi una riga di avviso: «Qui non c'è git: la riga del repo nel widget resterà vuota».

Il passo è finito quando ogni pezzo mancante è stato creato. Se non mancava nulla, il passo è finito subito.

## Passo 5: apertura della chat della checklist

Fallo sia dopo un'installazione sia quando c'era già tutto.

1. Se `mcp__ccd_session__start_session` e `mcp__ccd_session_mgmt__detach_session` sono tra gli strumenti differiti, caricali con ToolSearch.
2. Chiama `start_session` con:
   - `initiation`: `user_asked`
   - `context`: `fresh`
   - `use_worktree`: `false`
   - `title`: «Checklist: <PROGETTO>»
   - `prompt`: «Esegui `node strumenti-locali/avanzamento/stato.mjs` e mostra la checklist come dice il CLAUDE.md»
   - `background`: «Checklist di avanzamento del progetto <PROGETTO>: il registro è `documenti/lavori.yaml`, lo script `strumenti-locali/avanzamento/stato.mjs`. Il CLAUDE.md del progetto dice come mostrarla e quando aggiornare il registro.»
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

Aggiungi che per aprire o chiudere lavori basta dirlo in chat: la regola nel CLAUDE.md fa aggiornare il registro.

Il passo è finito quando il messaggio è scritto.
