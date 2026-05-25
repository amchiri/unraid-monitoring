# Unraid Dashboard & API

Dashboard de monitoring + API REST pour serveur Unraid, basé sur l'API GraphQL d'Unraid.

- **Backend** : Node + Express. Agrège le GraphQL Unraid en une API REST propre, garde la clé `x-api-key` côté serveur, supporte les contrôles (start/stop Docker & VM).
- **Frontend** : React + Vite + Tailwind. Dashboard sombre, auto-rafraîchi, jauges + sparklines.
- L'API REST est pensée pour être aussi consommée par une **app mobile** (JSON normalisé, CORS, auth Bearer optionnelle).

## Démarrage

```bash
npm install
cp .env.example .env   # puis renseigner UNRAID_GRAPHQL_URL et UNRAID_API_KEY
npm run dev            # API sur :3000, dashboard sur :5173
```

Ouvrir http://localhost:5173

### Production (un seul process : API + dashboard buildé)

```bash
npm run serve          # build puis sert le tout sur :3000
# ou séparément
npm run build
npm run start
```

## Configuration (`.env`)

| Variable | Description |
|---|---|
| `UNRAID_GRAPHQL_URL` | URL GraphQL du serveur Unraid (ex: `http://192.168.1.63/graphql`) |
| `UNRAID_API_KEY` | Clé API Unraid (en-tête `x-api-key`) |
| `PORT` | Port du serveur API/dashboard (défaut `3000`) |
| `API_TOKEN` | **Optionnel.** Si défini, toutes les routes `/api` (sauf `/health`) exigent `Authorization: Bearer <token>`. Laisser vide en dev. |

## API REST

Base : `/api`. Tout en JSON. Si `API_TOKEN` est défini, ajouter l'en-tête `Authorization: Bearer <token>`.

### Lecture

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | Ping + état de connexion Unraid (jamais protégé) |
| GET | `/api/overview` | **Vue agrégée** (système, métriques, array, docker, vms, ups, notifs) — résiliente, idéale pour l'écran d'accueil mobile |
| GET | `/api/system` | Infos matériel/OS/réseau/versions |
| GET | `/api/metrics` | CPU %, mémoire, températures (CPU/NVMe/GPU/disque) |
| GET | `/api/array` | État de l'array, capacité, disques data/parité/cache, parité |
| GET | `/api/disks` | Disques physiques + état SMART |
| GET | `/api/docker` | Conteneurs (état, image, ports, maj dispo) |
| GET | `/api/vms` | Machines virtuelles (`{available:false}` si non configuré) |
| GET | `/api/shares` | Partages utilisateur + usage |
| GET | `/api/ups` | Onduleur (`{available:false}` si absent) |
| GET | `/api/notifications` | Notifications non lues |

### Contrôles (mutations)

| Méthode | Route | Actions |
|---|---|---|
| POST | `/api/docker/:id/:action` | `start`, `stop`, `pause`, `unpause` |
| POST | `/api/vms/:id/:action` | `start`, `stop`, `pause`, `resume`, `forceStop`, `reboot`, `reset` |

`:id` est l'identifiant renvoyé par les endpoints de lecture (URL-encodé).

Exemple :
```bash
curl -X POST http://localhost:3000/api/docker/<id>/stop
```

## Notes

- **Températures** : les capteurs `CUSTOM` (ex: Corsair Commander Pro) renvoient des RPM/tensions
  faussement étiquetés en °C. L'API les exclut des agrégats (CPU/NVMe/GPU/disque) mais les expose
  dans `metrics.temperature.sensors` pour la vue détaillée.
- **Résilience** : chaque section est interrogée indépendamment. Une fonctionnalité absente
  (VM, UPS) n'empêche pas le reste de remonter.
- Les capacités array/disques sont en **kilo-octets** ; les disques physiques et partages en **octets**.
```
