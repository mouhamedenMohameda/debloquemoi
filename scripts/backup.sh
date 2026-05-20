#!/usr/bin/env bash
# Snapshot de la DB SQLite de auth-api + .env.local de Débloque-moi.
#
# La base de données du système (users, wallet, crédits) est gérée par
# auth-api et se trouve dans /opt/auth-api/data/auth-api.db.
# Ce script en fait un backup atomique (sqlite3 .backup) avant chaque deploy.
#
# - Conserve les 30 derniers backups (auto-rotation).
# - Code de sortie non-zéro si la DB est introuvable ou si l'intégrité KO,
#   ce qui bloque le deploy (set -euo pipefail dans deploy.sh).
#
# Usage :
#   bash /opt/debloquemoi/scripts/backup.sh
#   bash /opt/debloquemoi/scripts/backup.sh /tmp/my-custom-dest.db   # dest custom

set -euo pipefail

# La DB est celle de auth-api (même serveur, partagée entre les deux services)
DB="${DEBLOQUEMOI_DB:-/opt/auth-api/data/auth-api.db}"
BACKUP_DIR="${DEBLOQUEMOI_BACKUP_DIR:-/opt/debloquemoi/.backups}"
ENV_FILE="${DEBLOQUEMOI_ENV:-/opt/debloquemoi/.env.local}"
KEEP="${DEBLOQUEMOI_BACKUPS_KEEP:-30}"

if [ ! -f "$DB" ]; then
  echo "[backup] ERREUR : DB introuvable à $DB" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
DB_DEST="${1:-$BACKUP_DIR/debloquemoi-$TS.db}"

# ── Backup atomique via SQLite ──────────────────────────────────────────────
# .backup acquiert le bon lock SQLite et copie même si WAL est en cours.
sqlite3 "$DB" ".backup '$DB_DEST'"

# ── Vérification d'intégrité ────────────────────────────────────────────────
if ! sqlite3 "$DB_DEST" "PRAGMA integrity_check;" | grep -q '^ok$'; then
  echo "[backup] ERREUR : intégrité du backup KO ($DB_DEST)" >&2
  rm -f -- "$DB_DEST"
  exit 2
fi

chmod 600 "$DB_DEST"

# ── Snapshot du .env.local ──────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  ENV_DEST="$BACKUP_DIR/env-$TS.txt"
  cp -p "$ENV_FILE" "$ENV_DEST"
  chmod 600 "$ENV_DEST"
  echo "[backup] .env.local → $ENV_DEST"
fi

# ── Rotation : garde les N plus récents ────────────────────────────────────
ls -1t "$BACKUP_DIR"/debloquemoi-*.db  2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
ls -1t "$BACKUP_DIR"/env-*.txt         2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --

SIZE=$(du -h "$DB_DEST" | cut -f1)
COUNT=$(ls -1 "$BACKUP_DIR"/debloquemoi-*.db 2>/dev/null | wc -l | tr -d ' ')
echo "[backup] OK $DB_DEST ($SIZE) — $COUNT backups conservés"
