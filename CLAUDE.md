# CLAUDE.md

Dashboard de monitoring + API REST pour serveur Unraid, basé sur l'API GraphQL d'Unraid.

## Architecture

Deux parties dans un seul repo :

- **Backend** (`server/`, Node + Express, ESM, JS) : proxy vers le GraphQL Unraid, exposé
  en API REST normalisée. La clé `x-api-key` reste **côté serveur** (jamais envoyée au navigateur).
- **Frontend** (`src/`, React 18 + Vite + Tailwind v4 + TypeScript) : dashboard sombre,
  auto-rafraîchi par polling, **responsive (mobile/desktop)** et **installable en PWA**
  (ajout à l'écran d'accueil). Consomme uniquement l'API REST `/api`.

L'API REST est aussi pensée pour une **app mobile** (JSON normalisé, CORS ouvert, auth Bearer optionnelle).

```
server/
  index.js     Express : middleware auth Bearer optionnelle, montage /api, static dist en prod, attache le terminal WS
  unraid.js    Client GraphQL (gql / gqlSafe) + objet Q = requêtes par section
  api.js       Router REST : endpoints lecture + contrôles + normaliseurs
  host.js      Accès à l'hôte via nsenter (HOST_ACCESS) : helpers pour shell/console/execFile
  terminal.js  Terminal interactif WebSocket (/api/terminal) — PTY via `script`, pas de module natif
src/
  lib/api.ts       Client fetch typé + tous les types + map des endpoints (ajoute le Bearer token)
  lib/auth.ts      Token d'accès : localStorage + store React `needsAuth` (déclenché sur 401)
  lib/usePoll.ts   Hook de polling générique (fetch immédiat puis setInterval)
  lib/format.ts    Helpers d'affichage (octets, Ko, durée, %, °C)
  components/ui.tsx Primitives : Card, Gauge, Bar, Sparkline, Dot, Stat, ErrorNote, Btn (bouton tactile)
  components/*Panel.tsx  Un panneau par domaine, chacun appelle usePoll sur son endpoint
                         (DockerPanel affiche icône + lien WebUI de chaque conteneur)
  components/TerminalPanel.tsx  Terminal xterm.js connecté en WebSocket à /api/terminal
  App.tsx          En-tête sticky responsive (pastilles de stats) + grille des panneaux
  main.tsx         Montage React + enregistrement du service worker (PWA)
public/            Assets PWA servis à la racine : manifest.webmanifest, sw.js, icon-{180,192,512}.png, favicon.png
scripts/
  gen-icons.mjs    Génère les icônes PNG (encodeur PNG maison via zlib, aucune dépendance)
```

## Terminal interactif (`/api/terminal`)

Shell **root** complet (top, htop, nano, couleurs) servi en WebSocket, sans module natif :
node-pty exige python+gcc (absents d'Unraid), donc on utilise la commande système
`script -qfc "…" /dev/null` (util-linux) qui alloue un vrai PTY noyau.

- **Pas de PTY natif** : `server/terminal.js` spawn `script`, pipe stdio ↔ WebSocket.
  Le pts de l'enfant est retrouvé via `/proc/<pid>/fd/0` (scan par PPid), le **resize**
  se fait avec `stty -F /dev/pts/N rows R cols C` (émet SIGWINCH).
- **Protocole WS** : client→serveur en JSON `{type:'i', d}` (saisie) / `{type:'r', c, r}` (resize) ;
  serveur→client = octets bruts du terminal. Pas de double-echo (le PTY echo lui-même).
- **Sécurité** : si `API_TOKEN` est défini, la connexion WS exige `?token=<token>` (un navigateur
  ne peut pas poser d'en-tête sur un WebSocket). `TERMINAL_DISABLED=1` coupe la fonctionnalité,
  `TERMINAL_CWD` change le dossier de départ (défaut `/mnt/user`).
- **Proxy Vite** : `ws: true` sur `/api` (dans `vite.config.ts`) pour proxifier l'upgrade en dev.

### Conteneur vs hôte — accès au shell root d'Unraid (`HOST_ACCESS`, implémenté)

Le serveur Node tourne **dans** le conteneur Docker : son `bash`, son binaire `docker`, son
`/proc` et ses chemins (`/mnt/user`, `/var/log/syslog`) sont ceux du **conteneur**, pas de
l'hôte. Sans rien faire, le terminal ouvre donc un shell conteneur (prompt = ID du conteneur,
ex. `6f53ddef0f3d:~#`), `docker exec`/`docker logs` échouent (pas de binaire ni de socket) et
le syslog est invisible.

`server/host.js` résout ça en sortant vers les namespaces de **PID 1** (l'init de l'hôte) avec
`nsenter -t 1 -m -u -i -n -p --` (nsenter fourni par `util-linux`, déjà installé). Activé par
la variable **`HOST_ACCESS=1`** ; sinon comportement conteneur d'origine. Une fois sur l'hôte,
shell root réel, `/mnt/user`, syslog **et** le `docker` de l'hôte (qui seul voit les conteneurs)
deviennent accessibles **sans monter aucun volume**.

- **Prérequis conteneur** (sinon nsenter échoue, EPERM) : mode **privilégié**
  (`<Privileged>true</Privileged>`) **et** `--pid=host` dans les *Extra Parameters*. Les deux
  sont réglés par `unraid-template.xml`, et `HOST_ACCESS` y vaut `1` par défaut.
- **Ce qui passe par l'hôte** (via `host.js`) :
  - terminal système → `systemShellExec()` : `nsenter … bash -lc 'cd $TERMINAL_CWD; exec bash -l'` ;
  - console Docker → `dockerConsoleExec(name)` : `nsenter … docker exec -it <name> sh` ;
  - `/syslog` et `/docker/:name/logs` (api.js) → `hostArgv('tail'|'docker', …)`.
- **cwd** : en mode hôte, `script` démarre à `/` du conteneur (le cwd cible `/mnt/user` n'existe
  que côté hôte) ; le `cd` réel se fait **après** nsenter, dans le `bash -lc`.
- **Resize** : `findPts` met en cache le `/dev/pts/N` (du conteneur) du **premier** enfant de
  `script`, capté avant l'`exec nsenter` ; le pts reste celui du conteneur (fd hérité), donc
  `stty -F /dev/pts/N` côté conteneur reste correct. ⚠ À retester sur la machine réelle avec
  `--pid=host` (le scan `/proc` voit alors tous les process de l'hôte).

⚠️ **Sécurité** : privilégié + `--pid=host` + `HOST_ACCESS=1` + ce terminal web = root complet
sur l'hôte pour quiconque ouvre la page. N'activer qu'avec `API_TOKEN` défini (sinon mettre
`HOST_ACCESS=0` ou `TERMINAL_DISABLED=1`).

## PWA (installable sur écran d'accueil)

- **Assets dans `public/`** (copiés à la racine de `dist/` par Vite) : `manifest.webmanifest`,
  `sw.js` (service worker), icônes PNG. Les balises Apple/manifest sont dans `index.html`,
  l'enregistrement du SW dans `src/main.tsx`.
- **Icônes générées sans dépendance** : `node scripts/gen-icons.mjs` (encodeur PNG maison via
  `zlib`, car ni `sharp`/`canvas` ni outil image ne sont dispo sur l'hôte). Relancer après modif du visuel.
- **Service worker** : réseau d'abord avec secours cache ; **ne met jamais `/api` en cache** (données live).
- **Limite HTTPS** : l'install « complète » + le SW exigent un contexte sécurisé (HTTPS ou localhost).
  En LAN sur `http://<ip>:3000`, le SW ne s'enregistre pas (échec silencieux) mais l'« Ajout à l'écran
  d'accueil » iOS marche. Pour l'install complète à distance → passer par le tunnel Cloudflare (HTTPS).
- **Zones sûres iOS** : barre de statut `black` + classe `.app-shell` (marge basse `safe-area-inset`).

## Commandes

```bash
npm run dev      # API :3000 + dashboard :5173 (proxy /api → :3000, vite --host = accessible LAN)
npm run build    # tsc -b && vite build → dist/
npm run serve    # build + sert API+dashboard sur un seul port (:3000) en prod
npx tsc --noEmit # typecheck seul
```

Le dashboard tourne sur le serveur Unraid lui-même → y accéder depuis le LAN via
`http://<ip-unraid>:5173` (dev) ou `:3000` (prod).

## Configuration — `.env`

`UNRAID_GRAPHQL_URL`, `UNRAID_API_KEY` (en-tête x-api-key), `PORT` (défaut 3000),
`API_TOKEN` (optionnel : si défini, `/api/*` sauf `/health` exige `Authorization: Bearer <token>`,
et le WS terminal exige `?token=`). Côté PWA, `lib/auth.ts` + `TokenGate` gèrent ça : sur un 401,
un écran de saisie apparaît, le token est stocké en `localStorage` (persiste en PWA installée) et
envoyé à chaque requête ; bouton « token » en pied de page pour le changer.

Terminal / hôte : `TERMINAL_DISABLED=1` (coupe `/api/terminal`), `TERMINAL_CWD` (dossier de
départ, défaut `/mnt/user`), `HOST_ACCESS=1` (terminal/console/logs/syslog sur le **vrai hôte**
via nsenter — exige conteneur privilégié + `--pid=host` ; voir la section terminal).

## Conventions & pièges importants

- **Interroger chaque section séparément.** Certains champs racine du GraphQL Unraid sont
  NON_NULL : s'ils échouent (ex : `upsDevices` sans onduleur, `vms.domains` sans VM),
  ils **annulent toute la réponse**. D'où `gqlSafe` + un endpoint/requête par domaine, et
  `Promise.all` de requêtes isolées dans `/overview`. Ne jamais regrouper toutes les
  sections dans une seule requête GraphQL.
- **Températures : filtrer les capteurs `CUSTOM`.** Le Corsair Commander Pro renvoie des
  RPM/tensions faussement étiquetés `unit: CELSIUS`. `buildTemperature()` (dans `api.js`)
  n'agrège que les types fiables : `CPU_CORE, CPU_PACKAGE, DISK, NVME, GPU`. Ne pas se fier
  à `temperature.summary.average` du GraphQL (pollué). Les capteurs bruts restent exposés
  dans `metrics.temperature.sensors` pour la vue détaillée.
- **`current` des capteurs est un objet** `TemperatureReading { value, unit, status }`, pas un scalaire.
- **Unités** : capacités array/disques en **kilo-octets** (`formatKb`), disques physiques et
  partages en **octets** (`formatBytes`).
- **IDs Docker** = `PrefixedID` au format `imageHash:containerHash` (long, sans slash) ;
  toujours `encodeURIComponent` côté client.
- **Docker `icon`/`webUi`** (depuis `iconUrl`/`webUiUrl`) sont **optionnels** (souvent `null`).
  Côté UI : repli sur l'initiale du nom si pas d'icône, lien « Ouvrir » masqué si pas de WebUI.
- **Mutations** : namespaces GraphQL → `mutation { docker { start(id) {...} } }`,
  `mutation { vm { start(id) } }`. Passer l'id en variable `$id: PrefixedID!`.
- Ce serveur (« Tower », Unraid 7.2.7) **n'a ni VM ni UPS configurés** → ces endpoints
  renvoient `{available:false}` ; c'est normal, pas un bug.

## Ajouter un domaine de monitoring

1. Ajouter la requête dans `Q` (`server/unraid.js`).
2. Ajouter l'endpoint + normaliseur dans `server/api.js`.
3. Ajouter le type + la méthode dans `src/lib/api.ts`.
4. Créer `src/components/XxxPanel.tsx` (utiliser `usePoll` + les primitives `ui.tsx`).
5. Monter le panneau dans `src/App.tsx`.
