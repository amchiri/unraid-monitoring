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
  terminal.js  Terminal interactif WebSocket (/api/terminal) — PTY via `script`, pas de module natif
src/
  lib/api.ts       Client fetch typé + tous les types + map des endpoints
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
`API_TOKEN` (optionnel : si défini, `/api/*` sauf `/health` exige `Authorization: Bearer <token>`).

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
