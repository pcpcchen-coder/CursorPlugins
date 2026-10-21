# CursorPlugins fork operating guide

This folder is **fork-owned documentation**. The entire repository is an upstream fork; it is not a newly authored plugin collection.

| Item | Value |
| --- | --- |
| Upstream | https://github.com/cursor/plugins |
| Fork | https://github.com/pcpcchen-coder/CursorPlugins |
| Upstream-compatible baseline | main |
| Fork customization | custom/pstack |
| pstack source | pstack/ |
| Claude Code generated adapter | harness/pstack/claude-code/ |
| Validation | docs/fork/VALIDATION.md |
| Portability plan | docs/fork/PORTABILITY.md |

## Branch contract

1. **main:** Follow cursor/plugins main; avoid direct custom commits. GitHub's Sync fork can be used when no local main modifications exist.
2. **custom/pstack:** Fork-specific policy, integration files and reviewed changes. It is intentionally allowed to diverge.
3. **feature branches:** For changes requiring a PR into custom/pstack.
4. Sync upstream to main first, then explicitly merge or rebase updated main into custom/pstack and resolve conflicts. Do not force-push the shared main branch.

The GitHub Fork relationship already records the upstream origin. Setting a local Git remote is still recommended for command-line work.

## First-time local setup

~~~bash
git clone https://github.com/pcpcchen-coder/CursorPlugins.git
cd CursorPlugins
git remote add upstream https://github.com/cursor/plugins.git
git fetch upstream
git switch --track origin/custom/pstack
git remote -v
~~~

If the upstream remote already exists, skip adding it. Verify the fork's custom branch exists before switching.

## Update from Cursor safely

~~~bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
git switch custom/pstack
git merge main
# Resolve any conflicts, then run all validation commands.
node scripts/verify-fork.mjs
node scripts/generate-pstack-harness-trees.mjs --check
npm install --no-save ajv ajv-formats
node scripts/validate-plugins.mjs
git push origin custom/pstack
~~~

Prefer a dedicated sync PR for a nontrivial upstream merge. Stop if fast-forwarding main fails; inspect divergence rather than forcing it.

## What is and is not installed

- Cursor: source plugin and skills live in pstack/. The official /add-plugin pstack installs the official plugin, **not automatically this fork's custom branch**. For this fork, import a marketplace from this repository using Cursor's supported marketplace UI and verify which branch it tracks.
- Claude Code: the original root .claude-plugin/marketplace.json references the generated harness/pstack/claude-code plugin. Local testing of the custom branch can use claude --plugin-dir ./harness/pstack/claude-code.
- Codex: AGENTS.md provides governance for **this repo**. It is not a Codex adapter for the pstack playbooks; see PORTABILITY.md.

Do not change the original marketplace owner/name or pstack's metadata merely to test this fork. Do not publish a new plugin identity without checking compatibility and attribution.

## Acceptance for the first fork milestone

- [ ] GitHub PR on custom/pstack has green Fork guard and original plugin validation jobs.
- [ ] Fork-specific files stay separate from upstream-owned source files.
- [ ] Run the manual read-only Cursor and Claude Code tests in VALIDATION.md and record outcomes.
- [ ] Any unavailable runtime is explicitly reported as **not tested**, not passed.
- [ ] Before claiming Codex support, complete the Codex adapter acceptance gates in PORTABILITY.md.

## Attribution

pstack was authored by Lauren Tan and remains under the original MIT license. Preserve copyright and license files, and describe fork-specific modifications separately.
