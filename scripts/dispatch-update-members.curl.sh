#!/usr/bin/env sh
set -eu

OWNER="${GITHUB_OWNER:-ohtsuka0602}"
REPO="${GITHUB_REPO_NAME:-equal-love-links-k7p4x9q2m}"
WORKFLOW="${GITHUB_WORKFLOW_FILE:-update-members.yml}"
REF="${GITHUB_REF_NAME:-main}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
POLL_SECONDS="${RUN_POLL_SECONDS:-120}"
POLL_INTERVAL="${RUN_POLL_INTERVAL_SECONDS:-5}"
API_VERSION="2022-11-28"

if [ -z "$TOKEN" ]; then
  echo "Set GITHUB_TOKEN or GH_TOKEN to a token that can dispatch the workflow." >&2
  exit 1
fi

API="https://api.github.com/repos/$OWNER/$REPO/actions/workflows/$WORKFLOW"
REQUESTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BODY_FILE="$(mktemp)"
RESPONSE_FILE="$(mktemp)"
RUNS_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE" "$RESPONSE_FILE" "$RUNS_FILE"' EXIT

printf '{"ref":"%s"}\n' "$REF" > "$BODY_FILE"

STATUS="$(curl -sS -L \
  -o "$RESPONSE_FILE" \
  -w '%{http_code}' \
  -X POST \
  -H 'Accept: application/vnd.github+json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-GitHub-Api-Version: $API_VERSION" \
  -H 'Content-Type: application/json' \
  --data-binary "@$BODY_FILE" \
  "$API/dispatches")"

echo "Dispatch HTTP status: $STATUS"

case "$STATUS" in
  200|204) ;;
  *)
    cat "$RESPONSE_FILE"
    echo "Dispatch failed. Expected HTTP 204 No Content, or HTTP 200 on newer GitHub API responses." >&2
    exit 1
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "node was not found; skipping run lookup. Check Actions manually."
  exit 0
fi

DEADLINE=$(( $(date +%s) + POLL_SECONDS ))
RUN_JSON=""

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  curl -sS -L \
    -H 'Accept: application/vnd.github+json' \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-GitHub-Api-Version: $API_VERSION" \
    "$API/runs?event=workflow_dispatch&branch=$REF&per_page=10" > "$RUNS_FILE"

  RUN_JSON="$(node - "$RUNS_FILE" "$REQUESTED_AT" <<'NODE'
const fs = require('fs');
const [file, requestedAt] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const requested = new Date(requestedAt).getTime() - 5000;
const run = (data.workflow_runs || [])
  .filter((item) => item.event === 'workflow_dispatch' && new Date(item.created_at).getTime() >= requested)
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
if (run) {
  process.stdout.write(JSON.stringify({
    id: run.id,
    head_sha: run.head_sha,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
  }));
}
NODE
)"

  if [ -n "$RUN_JSON" ]; then
    break
  fi

  sleep "$POLL_INTERVAL"
done

if [ -z "$RUN_JSON" ]; then
  echo "Dispatch returned success, but no workflow_dispatch run was found within $POLL_SECONDS seconds." >&2
  exit 1
fi

node - "$RUN_JSON" <<'NODE'
const run = JSON.parse(process.argv[2]);
console.log('Run created:');
console.log(`  id: ${run.id}`);
console.log(`  head_sha: ${run.head_sha}`);
console.log(`  status: ${run.status}`);
console.log(`  conclusion: ${run.conclusion}`);
console.log(`  url: ${run.html_url}`);
NODE