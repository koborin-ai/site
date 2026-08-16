#!/usr/bin/env bash
# Computes PR labels from changed file paths and optional PR title.
#
# Usage:
#   PR_TITLE="fix(app): example" ./compute-pr-labels.sh path/to/file1 path/to/file2
#
# Output: one label per line (sorted, unique).

set -euo pipefail

PR_TITLE="${PR_TITLE:-}"

is_neutral_path() {
  case "$1" in
    *.lock | */package-lock.json | */pubspec.lock) return 0 ;;
    *) return 1 ;;
  esac
}

is_test_path() {
  case "$1" in
    */test/* | */tests/* | *_test.* | *.test.* | *.spec.*) return 0 ;;
    *) return 1 ;;
  esac
}

is_behavior_path() {
  case "$1" in
    app/* | content/* | infra/*) return 0 ;;
    .github/workflows/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_structure_path() {
  case "$1" in
    README.md | AGENTS.md) return 0 ;;
    .github/release.yml) return 0 ;;
    docs/* | .cursor/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_app_path() {
  case "$1" in
    app/* | content/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_infra_path() {
  case "$1" in
    infra/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_doc_path() {
  case "$1" in
    docs/* | README.md | AGENTS.md | .cursor/*) return 0 ;;
    *) return 1 ;;
  esac
}

is_ci_path() {
  case "$1" in
    .github/workflows/* | .github/dependabot.yml | .github/scripts/*) return 0 ;;
    *) return 1 ;;
  esac
}

compute_change_type() {
  local has_behavior=false
  local has_classifiable=false

  for file in "$@"; do
    if is_neutral_path "$file"; then
      continue
    fi

    has_classifiable=true

    if is_behavior_path "$file"; then
      has_behavior=true
      continue
    fi

    if is_structure_path "$file" || is_test_path "$file"; then
      continue
    fi

    # Unknown paths default to behavior to stay safe.
    has_behavior=true
  done

  if [[ "$has_classifiable" == false ]]; then
    echo "change:behavior"
    return
  fi

  if [[ "$has_behavior" == true ]]; then
    echo "change:behavior"
  else
    echo "change:structure"
  fi
}

compute_domain_labels() {
  local labels=()

  for file in "$@"; do
    if is_app_path "$file"; then labels+=("app"); fi
    if is_infra_path "$file"; then labels+=("infra"); fi
    if is_doc_path "$file"; then labels+=("doc"); fi
    if is_ci_path "$file"; then labels+=("ci"); fi
  done

  if ((${#labels[@]} == 0)); then
    return
  fi

  printf '%s\n' "${labels[@]}" | sort -u
}

compute_category_label() {
  local title="$1"
  if [[ "$title" =~ ^fix ]]; then
    echo "bug"
  elif [[ "$title" =~ ^feat ]]; then
    echo "feature"
  fi
}

if (("$#" == 0)); then
  echo "change:behavior"
  exit 0
fi

declare -a all_labels=()

change_type="$(compute_change_type "$@")"
all_labels+=("$change_type")

while IFS= read -r domain; do
  all_labels+=("$domain")
done < <(compute_domain_labels "$@")

category="$(compute_category_label "$PR_TITLE")"
if [[ -n "$category" ]]; then
  all_labels+=("$category")
fi

printf '%s\n' "${all_labels[@]}" | sort -u
