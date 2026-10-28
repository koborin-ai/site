#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ROOT/compute-pr-labels.sh"
GITHUB_DIR="$(cd "$ROOT/.." && pwd)"

emitted=""

run_labels() {
  local title="${1:-}"
  shift
  PR_TITLE="$title" bash "$SCRIPT" "$@"
}

labels_for() {
  output="$(run_labels "$@")"
  emitted+="$output"$'\n'
}

managed_labels() {
  sed -n '/const managed = new Set(\[/,/\]);/p' "$GITHUB_DIR/workflows/label-pr.yml" |
    grep -oE "'[^']+'" | tr -d "'" | sort
}

release_labels() {
  awk -v title="$1" '
    /^    - title: / { current = substr($0, index($0, ": ") + 2); next }
    /^  [^ ]/ { current = "" }
    current == title && /^        - / { sub(/^        - /, ""); print }
  ' "$GITHUB_DIR/release.yml"
}

assert_contains() {
  local output="$1"
  local expected="$2"
  if ! grep -qx "$expected" <<<"$output"; then
    echo "Expected label '$expected' in:" >&2
    echo "$output" >&2
    exit 1
  fi
}

assert_not_contains() {
  local output="$1"
  local unexpected="$2"
  if grep -qx "$unexpected" <<<"$output"; then
    echo "Did not expect label '$unexpected' in:" >&2
    echo "$output" >&2
    exit 1
  fi
}

assert_equals() {
  local what="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "$what mismatch. Expected:" >&2
    echo "$expected" >&2
    echo "Actual:" >&2
    echo "$actual" >&2
    exit 1
  fi
}

labels_for "" app/src/content/docs/tech/foo.mdx
assert_contains "$output" "app"

labels_for "" content/future.md
assert_not_contains "$output" "app"

labels_for "" AGENTS.md README.md
assert_contains "$output" "doc"

labels_for "" infra/lib/site_stack.dart
assert_contains "$output" "infra"

labels_for "feat(infra): add resource" infra/lib/site_stack.dart
assert_contains "$output" "feature"

labels_for "feat(app): x" app/src/foo.ts
assert_contains "$output" "feature"

labels_for "fix(infra): x" infra/lib/site_stack.dart
assert_contains "$output" "bug"

labels_for "" .github/workflows/app-ci.yml
assert_contains "$output" "ci"

labels_for "" app/src/foo.ts AGENTS.md
assert_contains "$output" "app"
assert_contains "$output" "doc"

assert_equals "Emitted labels against the label-pr.yml managed set" \
  "$(grep -v '^$' <<<"$emitted" | sort -u)" "$(managed_labels)"
assert_equals "Bug Fixes labels in release.yml" "$(release_labels "Bug Fixes")" "bug"
assert_contains "$(release_labels "Infrastructure Changes")" "terraform"

echo "All compute-pr-labels tests passed."
