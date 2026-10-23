#!/usr/bin/env bash
# Runs on the VM as the forced command of the CI deploy key: reads a release tarball on stdin.
set -euo pipefail

main() {
  cd "$HOME/guniform"
  local compose="docker compose -f docker-compose.yml"
  stage=$(mktemp -d)
  trap 'rm -rf "$stage"' EXIT

  tar xzf - -C "$stage"
  test -f "$stage/docker-compose.yml"
  for key in ADMIN_HOST PUBLIC_HOST; do
    grep -q "^$key=." .env || { echo "$key missing in .env" >&2; exit 1; }
  done

  mkdir -p "$HOME/backups"
  $compose exec -T db pg_dump -U guniform -d guniform | gzip > "$HOME/backups/predeploy-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  ls -1t "$HOME"/backups/predeploy-*.sql.gz | tail -n +11 | xargs -r rm --

  rm -rf backend frontend scripts
  cp -a "$stage"/. .
  $compose up -d --build --remove-orphans app caddy

  for _ in $(seq 90); do
    if curl -fsS http://127.0.0.1:8000/api/healthz >/dev/null 2>&1; then
      docker image prune -f >/dev/null
      echo "deployed"
      return
    fi
    sleep 2
  done
  $compose logs --tail=80 app >&2
  exit 1
}

main "$@"
