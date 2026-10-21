# Pstack Observatory — cross-repository execution dashboard

A deployable static GitHub Pages dashboard and a local-first run recorder in **custom/pstack**. It is not an official Cursor pstack feature. The original Cursor upstream `main` stays untouched.

## What is observable?

| Signal | Origin | Reliability |
| --- | --- | --- |
| Repository coverage | `dashboard/projects.json` plus uploaded runs | **Registered** is not the same as instrumented. Unreported use cannot be detected. |
| Run stage/status | Agent-supplied recorder calls | Self-reported; may be late, stale, or inaccurate |
| Start/end and elapsed progress | Snapshot timestamps | Reported; a 30-minute-old running snapshot is marked stale |
| Evidence links | Recorder `--evidence https://...` | Link is supplied, not externally validated |
| Failure / blocked context | `--note` on the associated step | Self-reported and subject to redaction |
| Original pstack installation | Not automatically monitored | You must instrument each project; no hidden runtime interception |

**Privacy is critical**: `pcpcchen-coder/CursorPlugins` is PUBLIC. Published run snapshots are committed to this public GitHub repository and exposed on Pages. Do not publish private source snippets, secrets, transcripts, internal paths or private project details. For private projects, keep local-only recordings and adopt a private telemetry backend before public sharing. Fine-grained tokens should only grant necessary Contents write access to the central repository, not the entire account.

## Open dashboard

After the `Pstack dashboard` workflow deploys successfully and Pages is enabled, open:

**https://pcpcchen-coder.github.io/CursorPlugins/**

Check the actual URL in the Actions deployment output. If not enabled, under **Settings → Pages** select **GitHub Actions** as build/deployment source, then re-run the workflow (or push to `custom/pstack`). The workflow uses `actions/configure-pages` with `enablement: true` to attempt enabling Pages automatically; whether this succeeds depends on repo and plan settings. You can always run it locally:

~~~bash
python3 -m http.server 8765 --directory dashboard
# http://localhost:8765/
~~~

The dashboard starts empty except for the known AIOS candidate labeled **Not instrumented**. Click **Explore example data** for explicitly fictional sample runs that never contribute to the live KPIs. Demo mode has a visible badge; Refresh returns to live data.

## Register and instrument a source repo

Assuming your `CursorPlugins` and AIOS repos are checked out as siblings:

~~~bash
cd CursorPlugins
# Must be on custom/pstack with this dashboard available.
git switch custom/pstack
node scripts/pstack-observer-install.mjs --target ../AIOS --repo pcpcchen-coder/AIOS
cd ../AIOS
git diff -- AGENTS.md .gitignore tools/pstack-observe.mjs
# Review first. Commit the installer changes only after approval.
~~~

The installer copies a standalone Node script, appends a bounded observability section to existing `AGENTS.md`, and gitignores `.pstack/observability/` so local runs remain private. Re-running the installer is idempotent. It does **not** invoke an agent, change the pstack playbooks, start any Run, or upload data. Agents are instructed to call the recorder; an agent ignoring instructions will not show up in the dashboard.

To register an additional project ahead of any Run, add `{"repo":"pcpcchen-coder/YourRepo","name":"YourRepo"}` to `dashboard/projects.json` in a PR. Once a Run is published, the dashboard discovers its repo even without prior registration.

## Run lifecycle (in source repo)

~~~bash
# Create the planned execution stages (adjust to match the chosen playbook).
node tools/pstack-observe.mjs start \
  --repo pcpcchen-coder/AIOS --title "Fix event loop issue" \
  --playbook bug-fix --steps "reproduce,diagnose,fix,test,review" \
  --branch feature/issue-123 --run issue-123-20261021

node tools/pstack-observe.mjs step --run issue-123-20261021 --step reproduce --status running
# ...actually reproduce...
node tools/pstack-observe.mjs step --run issue-123-20261021 --step reproduce \
  --status passed --note "Reproduced with regression test" \
  --evidence https://github.com/pcpcchen-coder/AIOS/actions

# Continue diagnose, fix, test, and review with honest statuses.
# Mark the remaining steps passed or explicitly skipped before passing the run.
node tools/pstack-observe.mjs finish --run issue-123-20261021 --status passed
~~~

Use `--workspace path/to/project` when running from outside its checkout. Events are appended to the latest bounded in-memory JSON history, and a full latest snapshot is written to `.pstack/observability/runs/<run-id>.json`. The `--run` identifier is stable for concurrent agents. Reusing an existing run ID is disallowed.

## Opt-in public publishing

A reporter run is **local only** by default. Publishing uses `gh api` and an authenticated identity with **Contents:write** permission for `pcpcchen-coder/CursorPlugins`.

~~~bash
# One-time, only after confirming this run contains no private information.
# Authenticate GitHub CLI outside your source code; never hard-code or commit tokens.
export PSTACK_OBSERVE_PUBLICATION_ACK=1
node tools/pstack-observe.mjs publish --run issue-123-20261021 --public-ok
~~~

This upserts `dashboard/data/runs/pcpcchen-coder/AIOS/<run-id>.json` on the central **custom/pstack** branch. A GitHub Actions push triggers the index builder and Pages deployment. To update after *each* stage, add `--publish --public-ok` to every `start`, `step`, `finish` invocation while the acknowledgment variable is set. The recorder uses the GitHub CLI's authenticated account or `GH_TOKEN`. Expect the dashboard's freshness to be limited by GitHub Actions queue and Pages publication delay; it is not a real-time websocket stream.

Do not pass `--publish` when the data is private. The automatic index only observes published snapshot files, not local ones. The design is intentionally safe by default. If a publish fails, the local snapshot is still retained; retry `publish` and record the error.

### Agent prompt template

~~~text
Please execute this task with pstack /poteto-mode and record the real steps using
`tools/pstack-observe.mjs` according to AGENTS.md. Keep a single stable run ID.
For each step, log running and then passed/failed/blocked/skipped with a short factual
note and GitHub-based evidence URL where possible. Do not claim pass before tests.
The recording stays local; do not publish to the public dashboard without my explicit authorization.
At the end report the run ID, coverage, failed/unverified steps, and publication status.
~~~

## Dashboard verification

From `CursorPlugins` root:

~~~bash
node --test tests/pstack-observability.test.mjs
node scripts/pstack-dashboard-build.mjs
node scripts/verify-fork.mjs
node scripts/generate-pstack-harness-trees.mjs --check
npm install --no-save ajv ajv-formats
node scripts/validate-plugins.mjs
~~~

Actions workflow `.github/workflows/pstack-dashboard.yml` tests, generates the index and deploys Pages from the custom branch. It deliberately does not deploy PR preview data. Actual Cursor, Claude Code and Codex playbook execution needs a separate interactive test and is **not** proven by the static dashboard CI.

### Acceptance criteria

1. Empty site clearly labels AIOS `Not instrumented`; no fabricated live runs.
2. Demo data visibly marked and excluded from live counts.
3. An actual run can start, log steps, finish and retain durable local JSON.
4. A failed step is displayed as failure with its note; passed runs cannot hide pending steps.
5. A publicly authorized publish creates/updates the central file and, after a Pages deploy, a repo and run appear with correct statuses.
6. Refresh shows the latest event after publication; stale running snapshots are flagged after 30 minutes.
7. Evidence links and unverified steps are visible and dynamically rendered safely, without arbitrary HTML execution.
8. Tests pass, original `main` stays identical to upstream, and no GitHub credentials are committed.

## Future enhancements

- GitHub App for write access without human PAT, webhooks and higher-frequency updates.
- A **private** telemetry store with authenticated viewer for confidential projects.
- Native pstack runtime instrumentation (currently agents must explicitly call the recorder).
- Automated evidence validation (CI checks, SHA matching, artifact provenance), heartbeat tracking, replay diff, and operator-reviewed confidence scoring.
