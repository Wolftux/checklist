# Checklist

Una skill per Claude Code, in italiano: `/checklist` installa in un progetto il registro dei lavori concordati con Claude e li mostra in una checklist di avanzamento, in una chat dedicata.

## Installazione

Serve Claude Code e Node.js 18 o successivo. Nel terminale:

```bash
claude plugin marketplace add Wolftux/checklist
claude plugin install checklist@checklist
```

Poi riavvia Claude Code (oppure lancia `/reload-plugins`).

## Uso

Scrivi `/checklist` nella cartella del progetto (nel menu può comparire come `/checklist:checklist`). La skill installa ciò che manca e apre la chat «Checklist: <progetto>» con la checklist. Per aggiungere o chiudere lavori basta dirlo in chat: la regola nel `CLAUDE.md` fa aggiornare il registro. Il pulsante «Aggiorna» scrive nella chat il messaggio «Aggiorna la checklist di …»: se non parte da solo, invialo.

## Cosa lascia nel progetto

- `documenti/lavori.yaml`: il registro dei lavori.
- `strumenti-locali/avanzamento/stato.mjs`: lo script che legge il registro (e lo stato di git) e produce lo stato in JSON.
- Un blocco «Checklist di avanzamento» in coda al `CLAUDE.md`, senza toccare il resto del file.
- Con git, due righe in `.git/info/exclude` (`**/documenti/lavori.yaml` e `**/strumenti-locali/avanzamento/`): registro e script restano fuori dal repo.

Ciò che esiste già non viene sovrascritto.

## Formato del registro

Una voce per lavoro, sotto `lavori:`. Campi:

| Campo | Contenuto |
|---|---|
| `id` | sigla breve, unica |
| `titolo` | cosa va fatto, in una riga |
| `gruppo` | libero (per esempio Codice, Prove, Pubblicazione) |
| `stato` | `da_fare`, `in_corso`, `in_attesa`, `fatto`, `rinviato` |
| `chi` | `utente`, `Claude`, `esterni` |
| `concordato` | data di accordo, AAAA-MM-GG |
| `fatto` | data di chiusura, solo con stato `fatto` |
| `note`, `fonte` | facoltativi |

«Aperti» sono tutti i lavori tranne `fatto` e `rinviato`. Il modello completo, con i commenti, è in `plugins/checklist/checklist/modelli/lavori.yaml`.

## Limiti

- La chat dedicata e il widget funzionano solo nell'app desktop. Nella CLI la checklist compare come tabella nella chat corrente.
- `/checklist` non sovrascrive uno script già installato, quindi non lo aggiorna. Per aggiornarlo, cancella `strumenti-locali/avanzamento/stato.mjs` e rilancia `/checklist`.
- Il formato è YAML semplificato: un valore per riga, niente testi su più righe, niente liste o voci annidate dentro una voce. Una riga che lo script non capisce non lo ferma, compare nella checklist con il suo numero.
- Nei worktree secondari di git `/checklist` si ferma: va lanciato dalla cartella principale.

## Crediti

Nata dalla checklist di [Cantiere](https://github.com/Wolftux/cantiere).

## Licenza

MIT, Mattia Balboni.

---

# English

**A progress checklist for any project, in Claude Code.** `/checklist` installs a registry of the jobs agreed with Claude in your project and shows them as a checklist in a dedicated chat. The skill speaks Italian.

## Install

Requires Claude Code and Node.js 18 or later.

```bash
claude plugin marketplace add Wolftux/checklist
claude plugin install checklist@checklist
```

Then restart Claude Code (or run `/reload-plugins`).

## Use

Type `/checklist` in the project folder (the menu may show it as `/checklist:checklist`). It adds what is missing (`documenti/lavori.yaml`, `strumenti-locali/avanzamento/stato.mjs`, a block in `CLAUDE.md`, two lines in `.git/info/exclude`: `**/documenti/lavori.yaml` and `**/strumenti-locali/avanzamento/`) and opens the checklist chat. Add or close jobs by saying so in chat. The «Aggiorna» (refresh) button writes the message «Aggiorna la checklist di …» in the chat: if it is not sent on its own, send it.

## Limits

The dedicated chat and the widget need the desktop app; the CLI shows a table in the current chat. An existing script is never overwritten, so it is not updated: to update it, delete `strumenti-locali/avanzamento/stato.mjs` and run `/checklist` again. The registry uses a simplified YAML.
