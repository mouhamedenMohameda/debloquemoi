#!/usr/bin/env bash
# Déploiement sûr de Débloque-moi (Next.js).
#
# Séquence :
#   1) Backup DB SQLite + .env.local via backup.sh (refuse de continuer si KO)
#   2) git fetch + affiche les commits entrants
#   3) git pull --ff-only
#   4) npm install si package.json a bougé
#   5) npm run build
#   6) systemctl restart + health check
#
# Usage :
#   bash /opt/debloquemoi/scripts/deploy.sh
#   bash /opt/debloquemoi/scripts/deploy.sh --no-pull   # backup + restart seulement

set -euo pipefail

REPO_DIR="${DEBLOQUEMOI_REPO:-/opt/debloquemoi}"
SERVICE="${DEBLOQUEMOI_SERVICE:-debloquemoi}"

NO_PULL=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) NO_PULL=1 ;;
    *) echo "Argument inconnu : $arg" >&2; exit 1 ;;
  esac
done

cd "$REPO_DIR"

# ─── 1. Backup DB SQLite + .env.local ─────────────────────────────────────
echo "═══ 1. Backup DB + .env.local ═══"
bash "$REPO_DIR/scripts/backup.sh"

# ─── 2. Pull ──────────────────────────────────────────────────────────────
if [ "$NO_PULL" -eq 0 ]; then
  echo
  echo "═══ 2. Récupération des nouveaux commits ═══"
  git fetch origin
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse @{u})
  if [ "$LOCAL" = "$REMOTE" ]; then
    echo "[deploy] Déjà à jour ($LOCAL)"
  else
    git log --oneline "$LOCAL..$REMOTE"
    echo
    git pull --ff-only
  fi
fi

# Réinstalle si package.json a bougé
if [ "$NO_PULL" -eq 0 ] && git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -qE '^package(-lock)?\.json$'; then
  echo
  echo "═══ package.json modifié — npm install ═══"
  npm install
fi

# ─── 3. Build ──────────────────────────────────────────────────────────────
echo
echo "═══ 3. npm run build ═══"
npm run build

# ─── 4. Restart ────────────────────────────────────────────────────────────
echo
echo "═══ 4. Redémarrage de $SERVICE ═══"
systemctl restart "$SERVICE"
sleep 3

if systemctl is-active --quiet "$SERVICE"; then
  echo "[deploy] systemctl is-active : OK"
else
  echo "[deploy] ERREUR : $SERVICE inactif après restart" >&2
  systemctl status "$SERVICE" --no-pager | tail -20
  exit 3
fi

# ─── 5. Health check ──────────────────────────────────────────────────────
echo
echo "═══ 5. Health check ═══"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://bac.radar-mr.com/login" || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ]; then
  echo "[deploy] /login répond : HTTP $HTTP_CODE — OK"
else
  echo "[deploy] ⚠️  /login HTTP $HTTP_CODE — à vérifier" >&2
fi

echo
echo "✅ Déploiement Débloque-moi OK — $(git log -1 --oneline)"
