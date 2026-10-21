# pstack cross-agent compatibility plan

Goal: share **engineering outcomes** (requirements, investigation, tests, evidence and review), rather than pretend Cursor, Claude Code, Codex and other agents have identical tools.

## Current scope

| Runtime | Current integration | Status | What must be tested |
| --- | --- | --- | --- |
| Cursor | Native pstack/.cursor-plugin and pstack/skills | Upstream baseline, not runtime-tested by this fork | Installation, setup-pstack, read-only poteto-mode |
| Claude Code | Generated harness/pstack/claude-code plus pstack/docs/harness/claude-code.md | Upstream adapter exists, not runtime-tested by this fork | Local plugin loading, pstack-prefixed skills, agent/tool mappings |
| Codex | Root AGENTS.md fork policy only | pstack playbook compatibility **not implemented** | Design and build a separate tested adapter |
| Other agents | No adapter | Not supported yet | Capability inventory + explicit opt-in |

## Integration design

Maintain a canonical source and runtime-specific adapters:

~~~text
pstack/                        # Upstream-owned canonical skills and agents
harness/pstack/claude-code/     # Upstream generated adapter: do not edit manually
docs/fork/                     # Fork policy, capability mapping, evidence
scripts/verify-fork.mjs         # Fork-only structural assertions
# Future (not created yet):
# harness/fork/codex/
# harness/fork/other-runtime/
~~~

When building a Codex adapter, design it as a **generated or packaged derivative**, not a blind symlink from .agents/skills/ to pstack/skills/. Cursor-specific tools, model names and automation semantics appear in the original source.

Codex recognizes AGENTS.md for repository guidance and skill packages based on SKILL.md. That alone does not translate Cursor subagents, slash commands, worktrees or tools. Each behavior needs a documented implementation or a clear unsupported fallback.

## Implementation milestones

### P0 — Safety and baseline (this PR)
- Preserve main, create custom/pstack, and document the upstream sync contract.
- Add Node-based fork structural checks to GitHub Actions.
- Define distinct static and interactive test evidence; do not assert runtime success from source review.

### P1 — Codex adapter (future PR)
1. Inventory each pstack playbook's required tools, subagent behavior and model constraints.
2. Define mapping: Cursor Task/delegation to the currently available Codex capability; AskQuestion to actual user interaction; model slugs to an explicit supported set or inherit-default; cloud tasks to documented local/remote isolation behavior.
3. Generate a derivative under harness/fork/codex/. Keep upstream source byte-for-byte unchanged, with a repeatable --check mode for generated output.
4. Give Codex an applicable SKILL.md entrypoint and an adapter document that describes unsupported steps explicitly.
5. Avoid unreviewed downloads, automatic PR merges and secrets in session logs.

### P2 — Additional agents (future PRs)
- Consider Claude Code model-specific improvements, ChatGPT Work, Hermes or OpenClaw only after their interfaces are evaluated.
- Reuse one verification contract (requirements -> actions -> artifacts -> evidence -> unresolved scope); make runtime adapters small and capability-driven.

## Adapter acceptance gates

1. Manifest/skill schema validation passes with no link or missing-file errors.
2. Read-only investigation playbook produces repo-grounded findings and changes no files.
3. Bug-fix playbook reproduces a seeded bug, patches the cause and runs a failing-then-passing test.
4. Feature playbook lists acceptance criteria and verifies them with reproducible commands.
5. Unsupported capabilities are surfaced explicitly; no fictitious tools, model names, parallelism, approvals or CI outcomes.
6. Independent replay captures command, version, commit SHA, artifacts, observed results and any unresolved risks.

Support is not declared until gates 1–6 have recorded evidence from a real running agent.

## Reference material

- pstack README: [pstack/README.md](../../pstack/README.md)
- Existing Claude adapter: pstack/docs/harness/claude-code.md
- Codex skills: https://developers.openai.com/api/docs/guides/tools-skills
- Codex repository guidance: https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex
