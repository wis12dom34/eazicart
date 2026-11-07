#!/usr/bin/env bash
# Read-only source/service inventory. No environment values, argv, DB rows or keys.
# Run on the authorized VPS after confirming the host/user; no sudo is invoked.
set -euo pipefail
export GIT_OPTIONAL_LOCKS=0
roots=("${1:-/opt/eazicart/source}")

if command -v systemctl >/dev/null 2>&1; then
  while IFS= read -r unit; do
    [[ -n "$unit" ]] || continue
    printf 'service=%s\n' "$unit"
    systemctl show "$unit" --no-pager --property=FragmentPath --property=WorkingDirectory --property=MainPID 2>/dev/null || true
    cwd=$(systemctl show "$unit" --value --property=WorkingDirectory 2>/dev/null || true)
    [[ -z "$cwd" || ! -d "$cwd" ]] || roots+=("$cwd")
  done < <(systemctl list-units --type=service --all --plain --no-legend --no-pager 2>/dev/null | awk '$1 ~ /eazicart/ { print $1 }' || true)
fi

# Process argv and environment may contain secrets, so inspect only exe/cwd links.
while IFS= read -r pid; do
  [[ "$pid" =~ ^[0-9]+$ ]] || continue
  cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
  [[ "$cwd" == *eazicart* ]] || continue
  executable=$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)
  printf 'process_pid=%s cwd=%s executable=%s\n' "$pid" "$cwd" "$executable"
  roots+=("$cwd")
done < <(ps -eo pid=,comm= | awk '$2 == "node" || $2 == "MainThread" || $2 ~ /^next-server/ { print $1 }')

# Inspect only selected metadata, never full docker inspect output (it contains env).
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.ID}}' >/dev/null 2>&1; then
  while IFS= read -r container; do
    [[ -n "$container" ]] || continue
    docker inspect --type container --format 'container={{.Name}} image={{.Config.Image}} image_id={{.Image}} working_dir={{.Config.WorkingDir}} compose_working_dir={{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$container"
    docker inspect --type container --format '{{range .Mounts}}{{println "mount_type=" .Type "source=" .Source "destination=" .Destination}}{{end}}' "$container"
    while IFS= read -r bind_root; do
      [[ -z "$bind_root" || ! -d "$bind_root" ]] || roots+=("$bind_root")
    done < <(docker inspect --type container --format '{{range .Mounts}}{{if eq .Type "bind"}}{{println .Source}}{{end}}{{end}}' "$container")
  done < <({ docker ps --filter name=eazicart --format '{{.ID}}'; docker ps --filter label=com.docker.compose.project=eazicart --format '{{.ID}}'; } | sort -u)
fi

declare -A inspected=()
for candidate in "${roots[@]}"; do
  if [[ ! -d "$candidate" ]]; then
    printf 'source_candidate_missing=%s\n' "$candidate"
    continue
  fi
  actual=$(readlink -f "$candidate")
  root=$(git -c safe.directory="$actual" -C "$actual" rev-parse --show-toplevel 2>/dev/null || true)
  if [[ -z "$root" ]]; then
    printf 'source_candidate=%s resolved=%s git_root=unavailable\n' "$candidate" "$actual"
    continue
  fi
  [[ -z "${inspected[$root]:-}" ]] || continue
  inspected[$root]=1
  printf 'source_candidate=%s resolved=%s git_root=%s\n' "$candidate" "$actual" "$root"
  git -c safe.directory="$root" -C "$root" rev-parse HEAD
  git -c safe.directory="$root" -C "$root" status --short
  git -c safe.directory="$root" -C "$root" diff --stat
  if command -v rg >/dev/null 2>&1; then
    rg --files --hidden -g AGENTS.md -g '!node_modules/**' -g '!.git/**' -g '!.next*/**' "$root" || true
  fi
  parent="$root"
  while [[ "$parent" != / ]]; do
    parent=$(dirname "$parent")
    [[ ! -f "$parent/AGENTS.md" ]] || printf 'ancestor_instructions=%s/AGENTS.md\n' "${parent%/}"
  done
  for relative in packages/database/prisma/schema.prisma apps/api/src/modules/payments/index.ts apps/api/src/app.ts apps/web/package.json; do
    [[ ! -f "$root/$relative" ]] || sha256sum "$root/$relative"
  done
done
