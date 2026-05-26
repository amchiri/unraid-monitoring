// ---------------------------------------------------------------------------
// Accès au système hôte Unraid depuis le conteneur, via `nsenter`.
//
// Le serveur Node tourne DANS le conteneur Docker : son shell, son binaire
// `docker`, son /proc et ses chemins (/mnt/user, /var/log/syslog) sont ceux du
// CONTENEUR, pas de l'hôte. Pour voir le vrai root de l'hôte (shell root réel,
// partages, syslog) et piloter les conteneurs via le `docker` de l'hôte, on
// entre dans les namespaces de PID 1 (l'init de l'hôte) avec `nsenter`.
//
// Prérequis sur le conteneur (sinon nsenter échoue avec EPERM / "no such
// process") :
//   - mode privilégié            <Privileged>true</Privileged>
//   - partage du PID namespace    --pid=host   (Extra Parameters)
//
// Activé uniquement si HOST_ACCESS=1 ; sinon comportement conteneur d'origine.
// ⚠ Sécurité : privilégié + --pid=host + terminal web = root complet sur l'hôte
// pour quiconque ouvre la page. N'activer qu'avec API_TOKEN défini.
// ---------------------------------------------------------------------------

export const HOST_ACCESS =
  process.env.HOST_ACCESS === '1' || process.env.HOST_ACCESS === 'true'

// Entre dans tous les namespaces de l'hôte (PID 1) : mount, uts, ipc, net, pid.
const NSENTER = ['nsenter', '-t', '1', '-m', '-u', '-i', '-n', '-p', '--']

// Échappe une chaîne pour un contexte shell entre quotes simples.
function shq(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`
}

/**
 * argv `(file, args)` à passer à execFile : enrobé dans nsenter si HOST_ACCESS,
 * sinon renvoyé tel quel. Permet d'exécuter `tail`, `docker`, … sur l'hôte.
 */
export function hostArgv(file, args = []) {
  return HOST_ACCESS
    ? [NSENTER[0], [...NSENTER.slice(1), file, ...args]]
    : [file, args]
}

/**
 * Fragment `exec …` pour le shell système interactif (passé à `script -c`).
 * Avec HOST_ACCESS : saute sur le shell root de l'hôte et se place dans
 * TERMINAL_CWD (défaut /mnt/user) qui n'existe que côté hôte.
 */
export function systemShellExec() {
  if (!HOST_ACCESS) return 'exec bash -l'
  const dir = process.env.TERMINAL_CWD?.trim() || '/mnt/user'
  const inner = `cd ${shq(dir)} 2>/dev/null; exec bash -l`
  return `exec ${NSENTER.join(' ')} bash -lc ${shq(inner)}`
}

/**
 * Fragment `exec …` pour ouvrir une console dans un conteneur Docker.
 * Avec HOST_ACCESS, `docker` est celui de l'hôte (le seul qui voit les
 * conteneurs). `name` est déjà validé `^[a-zA-Z0-9_.\-]+$` par l'appelant.
 */
export function dockerConsoleExec(name) {
  const base = `docker exec -it ${name} sh`
  return HOST_ACCESS ? `exec ${NSENTER.join(' ')} ${base}` : `exec ${base}`
}
