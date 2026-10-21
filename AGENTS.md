# CursorPlugins fork engineering contract

This file guides coding agents working **in this fork**. It does not replace the original pstack plugin instructions.

## Source of truth
- Upstream: https://github.com/cursor/plugins (default branch: main).
- Fork: https://github.com/pcpcchen-coder/CursorPlugins.
- Keep fork main as a clean, fast-forwardable mirror of upstream main.
- Develop fork-specific changes on custom/pstack or topic branches based on it.
- Keep customization and operator notes under docs/fork/, and fork-only tooling under scripts/ and .github/workflows/ where practical.
- Never silently alter upstream pstack playbooks, author metadata, license files, or generated harness trees.

## Before editing
1. Read docs/fork/README.md, docs/fork/PORTABILITY.md and the applicable upstream README and SKILL.md.
2. Check git status, current branch, existing changes, and upstream state before edits.
3. For pstack source changes, inspect scripts/generate-pstack-harness-trees.mjs and its generated outputs. Never hand-edit harness/pstack/claude-code.
4. Classify whether work is documentation-only, adapter integration, or upstream source change.

## Verification and evidence
- Run: node scripts/verify-fork.mjs
- Run: node scripts/generate-pstack-harness-trees.mjs --check
- Run: npm install --no-save ajv ajv-formats && node scripts/validate-plugins.mjs
- See docs/fork/VALIDATION.md for manual Cursor/Claude Code smoke tests.
- Never report a runtime, editor, or model as verified just because static checks pass.
- Document commands, environment, observed output, unresolved limitations and any skipped checks in the PR.

## Cross-runtime safety
- Cursor pstack is the original baseline. Claude Code uses the generated adapter and requires its own smoke test.
- Codex/other-agent adaptation is **planned, not yet implemented**. Do not claim native pstack command compatibility.
- Tool names, permissions, subagent features, models and isolation are runtime-specific. Map capabilities explicitly and fail or disclose when unavailable; never invent an equivalent.
- Keep credentials, transcripts, local memory and machine-specific paths out of commits.

## Delivery
- Prefer small, reviewable PRs to custom/pstack. Do not automatically merge unverified cross-runtime changes.
- Preserve attribution and the original LICENSE; document deviations from upstream.
- For any new adapter, supply reproducible tests and positive/negative examples before calling it supported.
