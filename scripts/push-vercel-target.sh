#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "preview" && "$TARGET" != "production" ]]; then
  echo "Usage: scripts/push-vercel-target.sh [preview|production]" >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
AHEAD_MAIN="$(git rev-list --count origin/main..main 2>/dev/null || echo 0)"
AHEAD_OPENCLAW="$(git rev-list --count origin/openclaw..openclaw 2>/dev/null || echo 0)"

if [[ "$TARGET" == "production" ]]; then
  if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "Refusing production push from branch '$CURRENT_BRANCH'. Switch to 'main' first." >&2
    exit 1
  fi
  echo "Production push: main -> origin/main"
  echo "Local main ahead of origin/main by: $AHEAD_MAIN commit(s)"
  git push origin main
  exit 0
fi

if [[ "$CURRENT_BRANCH" != "openclaw" && "$CURRENT_BRANCH" != "main" ]]; then
  echo "Preview pushes should come from 'openclaw' (or explicitly from 'main' if intended). Current branch: '$CURRENT_BRANCH'" >&2
  exit 1
fi

SOURCE_BRANCH="$CURRENT_BRANCH"
if [[ "$CURRENT_BRANCH" == "main" ]]; then
  echo "Warning: you are pushing preview from 'main'."
fi

echo "Preview push: $SOURCE_BRANCH -> origin/openclaw"
echo "Local openclaw ahead of origin/openclaw by: $AHEAD_OPENCLAW commit(s)"
git push origin "$SOURCE_BRANCH":openclaw
