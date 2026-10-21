# Baseline verification and smoke-test record

Static checks confirm repository consistency; they **do not** prove that a runtime installed a plugin or successfully delegated an agent.

## 1. Static checks (Node 20 or newer)

From the repository root:

~~~bash
node scripts/verify-fork.mjs
node scripts/generate-pstack-harness-trees.mjs --check
npm install --no-save ajv ajv-formats
node scripts/validate-plugins.mjs
~~~

Expected: exit code 0 for each command. Keep the complete CI logs as evidence. The first check has no npm dependencies; GitHub Actions runs it on pushes to custom/** and relevant PRs. The original Validate plugins workflow also runs for matching changes and checks generated Claude Code artifacts.

The plugin manifest at pstack/plugin.json and the generated output at harness/pstack/claude-code must remain in sync after upstream pstack source changes.

## 2. Cursor interactive smoke test (manual)

Environment: Cursor version and OS must be recorded.

1. Install original official pstack through Cursor's plugin UI or /add-plugin pstack. If testing the fork instead, import its marketplace and confirm the tracked branch before installation.
2. Start a throwaway repository or read-only task in a disposable worktree.
3. Run /setup-pstack, record the selected budget/models. Skipping setup is **not** proof that defaults are right for your available models.
4. Run /poteto-mode with: "Investigate read-only: where do the plugin manifest and setup skill live? Cite actual paths; do not edit any file."
5. Verify task classification, paths, no unintended edits and honest notes for unavailable features.

Pass: actual skill invocation plus path-grounded reply; git status contains no unexpected changes.

## 3. Claude Code interactive smoke test (manual)

From a locally checked-out custom/pstack branch:

~~~bash
claude --plugin-dir ./harness/pstack/claude-code
~~~

Inside Claude Code, run /pstack:setup-pstack and select real locally available models. Then test /pstack:poteto-mode with the same read-only investigation. Verify the generated plugin loads, namespace prefixes resolve, the Claude Code adapter is read, and any Cursor-only feature is reported as skipped rather than falsely simulated.

Pass: observed command invocation, correct namespaced skill, no unexpected changed files and a record of supported/unsupported steps.

Alternatively, installing via the fork marketplace requires checking its branch and the registered marketplace name. Do not silently use the official cursor/plugins marketplace when evaluating the fork.

## 4. Codex

Only the fork-level AGENTS.md governance is presently provided. **Do not** report pstack playbook compatibility or /poteto-mode availability in Codex. Track adapter work against PORTABILITY.md P1 gates.

## Evidence template

~~~text
Run date / operator:
Runtime / version / OS:
Repository / branch / commit SHA:
Install method and marketplace source:
Configuration / model(s) / budget:
Command or prompt:
Observed behavior and exact log/artifact path:
git status before / after:
Pass / Fail / Not tested:
Missing features / risk / next action:
~~~

Use "Not tested" when the editor or CLI was unavailable. Never replace observed results with assumptions.
