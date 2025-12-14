# /check-secrets

## Overview
`/check-secrets` scans the entire codebase for potential secret leaks, including API keys, tokens, passwords, hardcoded project IDs, and company-specific identifiers. The command searches through all tracked files (excluding `.gitignore` entries), applies pattern matching rules, and reports findings with file paths and line numbers. It helps prevent accidental commits of sensitive information before pushing to remote repositories.

## Usage
```text
/check-secrets [--include-docs] [--strict]
```

- `--include-docs` (optional): scan documentation files (`*.md`, `docs/`) which are normally excluded.
- `--strict` (optional): enable stricter pattern matching that may produce more false positives.

## Prerequisites
- Run from the repository root.
- Git repository is initialized (uses `.gitignore` to skip irrelevant files).
- No additional tools required beyond standard `grep` and `git`.

## Execution Flow (steps)

### 1. Define detection patterns
Build a list of regex patterns for common secrets:

**High-risk patterns:**
- API keys: `['\"]?[A-Z0-9_]{20,}['\"]?` (long uppercase alphanumeric strings)
- Bearer tokens: `Bearer\s+[A-Za-z0-9\-._~+/]+=*`
- Private keys: `-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----`
- OAuth secrets: `client_secret['\"]?\s*[:=]\s*['\"]?[A-Za-z0-9\-_]{20,}`
- GCP service account keys: `"type":\s*"service_account"`
- AWS credentials: `AKIA[0-9A-Z]{16}`

**Project-specific patterns:**
- Hardcoded project IDs: `koborin-ai` (when not in variable assignments or docs)
- Email addresses: `@koborin\.ai`
- Specific domain references outside of config files

**Excluded patterns (safe):**
- Environment variable references: `process.env.`, `$\{`, `TF_VAR_`
- Placeholder values: `<PROJECT_ID>`, `YOUR_API_KEY`, `dummy`, `example`
- Test fixtures: files under `__tests__/`, `*.test.ts`, `*.spec.ts`

### 2. Scan the codebase
Use `git ls-files` to get tracked files and apply grep patterns:

```bash
# Get all tracked files excluding binary and generated files
git ls-files | grep -v -E '\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|pdf)$' | \
  grep -v -E '^(node_modules|\.next|dist|build|coverage)/'
```

For each pattern, run:
```bash
grep -nHE '<pattern>' <file_list>
```

### 3. Filter false positives
Remove known safe occurrences:
- Lines containing `process.env.` or `TF_VAR_`
- Lines in `.env.example`, `.env.template`, or similar template files
- Lines with placeholder patterns (`<...>`, `YOUR_...`, `REPLACE_ME`)
- Comments explaining what secrets should be (e.g., `// Set your API key here`)

### 4. Categorize findings
Group results by severity:

**Critical (immediate action required):**
- Private keys, service account JSON
- Hardcoded passwords or tokens
- Real API keys with valid format

**Warning (review recommended):**
- Suspicious long strings that might be keys
- Hardcoded project IDs outside of infrastructure code
- Email addresses in non-documentation files

**Info (low risk but worth checking):**
- Company name in unexpected places
- Domain references in application code

### 5. Display results
Present findings in this format:

```
🔴 CRITICAL: Potential private key detected
  File: infra/shared/main.tf
  Line: 42
  Match: -----BEGIN PRIVATE KEY-----

⚠️  WARNING: Hardcoded project ID
  File: app/src/lib/api-client.ts
  Line: 15
  Match: const PROJECT = "koborin-ai"

ℹ️  INFO: Company domain reference
  File: app/src/components/Footer.tsx
  Line: 8
  Match: contact@koborin.ai

Summary:
- Critical: 1 finding(s)
- Warning: 1 finding(s)
- Info: 1 finding(s)

Review these findings before committing. Use environment variables or Secret Manager for sensitive values.
```

### 6. Exit with appropriate code
- Exit 1 if any critical findings exist
- Exit 0 otherwise (warnings/info are non-blocking)

## AI considerations

### Pattern matching strategy
- Balance between catching real secrets and minimizing false positives
- Prioritize high-entropy strings (random-looking sequences) over dictionary words
- Consider context: a 40-character hex string in a config file is more suspicious than in a test fixture

### Repository-specific customization
For `koborin-ai`:
- Allow `koborin-ai` in `infra/` and `README.md` (expected)
- Flag it in `app/src/` unless it's from an environment variable
- Allow email addresses in documentation and contact forms
- Flag GCP project IDs when hardcoded outside of Terraform variable definitions

### Handling edge cases
- Large files: scan in chunks to avoid memory issues
- Binary files: skip automatically via `git ls-files`
- Generated code: exclude `.next/`, `node_modules/`

## Notes
- This command performs static analysis only; it cannot detect secrets loaded at runtime
- Always review findings manually—automated detection may miss obfuscated secrets or produce false positives
- Run this command before every commit, or integrate it into a pre-commit hook
- For CI/CD, consider using dedicated tools like `gitleaks` or `trufflehog` for deeper analysis
- **Never commit real secrets even if this tool doesn't detect them**—use environment variables, Secret Manager, or GitHub Secrets

## Examples

### Basic scan
```text
/check-secrets

Output:
✅ No critical secrets detected.

⚠️  WARNING: Hardcoded project ID
  File: infra/shared/main.tf
  Line: 62
  Match: project: "koborin-ai"
  Note: This is acceptable in infrastructure code when used as a variable default.

Summary: 0 critical, 1 warning, 0 info
```

### Strict mode scan including docs
```text
/check-secrets --include-docs --strict

Output:
ℹ️  INFO: Email address in documentation
  File: README.md
  Line: 89
  Match: contact@koborin.ai
  Note: Acceptable in public documentation.

ℹ️  INFO: Domain reference
  File: docs/contact-flow.md
  Line: 12
  Match: https://koborin.ai/api/contact

Summary: 0 critical, 0 warning, 2 info
```

## Related commands
- `/commit-push-pr`: run `/check-secrets` before creating a PR to ensure no leaks
- `/update-agents-md`: add rules about secret management if patterns are frequently violated

## References
- GitHub's secret scanning patterns: https://docs.github.com/en/code-security/secret-scanning/secret-scanning-patterns
- OWASP secrets management guide: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

