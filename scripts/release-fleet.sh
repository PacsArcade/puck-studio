#!/usr/bin/env bash
# TASK-285A — release the five rescoped @frens-earth puck-studio packages
# as GitHub releases on PacsArcade/puck-studio.
#
# DRY-RUN by default: prints every `gh release create` command without
# running it. Pass --run to actually execute them (requires `gh auth
# status` to be logged in as the Admiral's account with push rights on
# PacsArcade/puck-studio).
#
# Packs are expected at:
#   /home/pac/dev/home/outbox/task-285a/packs/frens-earth-<pkg>-<ver>.tgz
#
# Usage:
#   scripts/release-fleet.sh          # dry run — prints the gh commands
#   scripts/release-fleet.sh --run    # executes them for real

set -euo pipefail

REPO="PacsArcade/puck-studio"
PACKS_DIR="/home/pac/dev/home/outbox/task-285a/packs"
RUN=0

if [[ "${1:-}" == "--run" ]]; then
  RUN=1
fi

# pkg name : version : old scoped name (for the release notes' provenance line)
PACKAGES=(
  "plugin-rails:0.4.0:@pacsarcade/plugin-rails@0.3.0"
  "presence:0.2.0:@pacsarcade/presence@0.1.0"
  "puck-changelog:0.2.0:@pacsarcade/puck-changelog@0.1.1"
  "puck-config:0.14.0:@pacsarcade/puck-config@0.13.0"
  "variant-engine:0.4.0:@pacsarcade/variant-engine@0.3.0"
)

for entry in "${PACKAGES[@]}"; do
  IFS=":" read -r pkg ver oldid <<< "$entry"
  tag="${pkg}-v${ver}"
  asset="${PACKS_DIR}/frens-earth-${pkg}-${ver}.tgz"
  title="${pkg} v${ver} (@frens-earth/${pkg})"
  notes="Rescoped from ${oldid} to @frens-earth/${pkg}@${ver} — TASK-285A, the Admiral's scope ruling 0018.06.25 a₿ · block 967,144. Same code, neutral scope; no functional change beyond the import path."

  if [[ ! -f "$asset" ]]; then
    echo "MISSING PACK: $asset — run npm pack for $pkg first" >&2
    exit 1
  fi

  cmd=(gh release create "$tag" "$asset" --repo "$REPO" --title "$title" --notes "$notes")

  if [[ "$RUN" -eq 1 ]]; then
    echo "+ ${cmd[*]}"
    "${cmd[@]}"
  else
    echo "[dry-run] ${cmd[*]}"
  fi
done

if [[ "$RUN" -eq 0 ]]; then
  echo
  echo "Dry run only — nothing was released. Re-run with --run to execute."
fi
