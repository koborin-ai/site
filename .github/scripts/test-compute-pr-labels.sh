#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ROOT/compute-pr-labels.sh"

run_labels() {
  local title="${1:-}"
  shift
  PR_TITLE="$title" bash "$SCRIPT" "$@"
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

output="$(run_labels "" app/src/content/docs/tech/foo.mdx)"
assert_contains "$output" "change:behavior"
assert_contains "$output" "app"

output="$(run_labels "" AGENTS.md README.md)"
assert_contains "$output" "change:structure"
assert_contains "$output" "doc"

output="$(run_labels "" infra/lib/site_stack.dart)"
assert_contains "$output" "change:behavior"
assert_contains "$output" "infra"

output="$(run_labels "feat(infra): add resource" infra/lib/site_stack.dart)"
assert_contains "$output" "feature"

output="$(run_labels "" .github/workflows/app-ci.yml)"
assert_contains "$output" "change:behavior"
assert_contains "$output" "ci"

output="$(run_labels "" app/src/foo.ts AGENTS.md)"
assert_contains "$output" "change:behavior"
assert_not_contains "$output" "change:structure"

echo "All compute-pr-labels tests passed."
