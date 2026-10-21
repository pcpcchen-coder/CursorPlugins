#!/usr/bin/env node
/** Explicit local installer for pstack observation on a target project. No telemetry is sent. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const home = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = name => { const i=argv.indexOf(`--${name}`); return i<0?null:argv[i+1]; };
const targetArg = flag('target'), repo = flag('repo');
const markerBegin = '<!-- PSTACK_OBSERVABILITY_BEGIN -->';
const markerEnd = '<!-- PSTACK_OBSERVABILITY_END -->';
if (!targetArg || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo||'')) {
  console.error('Usage: node scripts/pstack-observer-install.mjs --target ../AIOS --repo pcpcchen-coder/AIOS');
  process.exit(2);
}
const target = resolve(targetArg);
if (!existsSync(join(target,'.git'))) {
  console.error('Target must be an existing Git checkout with a .git path; refusing to modify unrelated folder.');
  process.exit(2);
}
const toolDir=join(target,'tools');
const toolPath=join(toolDir,'pstack-observe.mjs');
const srcPath=join(home,'scripts','pstack-observe.mjs');
const agentsPath=join(target,'AGENTS.md');
const ignorePath=join(target,'.gitignore');
const code = `${markerBegin}
## pstack workflow observability (installed by CursorPlugins)

When a task explicitly invokes pstack, record its **actual** execution. Never fabricate results or infer completion from a plan. Use the local recorder from the repository root:

\`node tools/pstack-observe.mjs start --repo ${repo} --title "<task title>" --playbook <playbook> --steps "investigate,implement,verify,review" --branch <git-branch>\`

Capture \`RUN_ID=...\` from stdout. Call \`step --run <RUN_ID> --step <step-id> --status running\` before each real stage and use \`--status passed|failed|blocked|skipped --note "..." --evidence https://github.com/...\` after collecting evidence. Finish with \`finish --run <RUN_ID> --status passed|failed|blocked|cancelled\`. A passing run requires every step to have passed or been explicitly skipped; mark blocked or failed honestly.

Runs stay in \`.pstack/observability/runs/\` (gitignored by default). There is **no** automatic public upload. To publish one run, the human must explicitly authorize public metadata disclosure and provide the GH authentication scope; see the parent CursorPlugins docs/fork/PSTACK_DASHBOARD.md. Once approved, use \`publish --run <RUN_ID> --public-ok\` with \`PSTACK_OBSERVE_PUBLICATION_ACK=1\`. Do not upload secrets, full prompts, transcripts, filenames with private context, or personally identifying data.

The dashboard is read-only and evidence is self-reported, not independently verified. If recording fails, report the failure and do not misstate progress.
${markerEnd}
`;
mkdirSync(toolDir, { recursive:true });
if (existsSync(toolPath) && readFileSync(toolPath,'utf8') !== readFileSync(srcPath,'utf8')) {
  console.error(`Refusing to overwrite modified tool: ${toolPath}`);
  process.exit(1);
}
copyFileSync(srcPath,toolPath);
let agents=existsSync(agentsPath)?readFileSync(agentsPath,'utf8'):'';
if (agents.includes(markerBegin) || agents.includes(markerEnd)) {
  const start=agents.indexOf(markerBegin),end=agents.indexOf(markerEnd);
  if(start<0||end<start)throw new Error('AGENTS.md marker is incomplete; inspect file manually');
  agents=agents.slice(0,start)+code+agents.slice(end+markerEnd.length);
} else agents+=`${agents.endsWith('\n')?'':'\n'}\n${code}`;
writeFileSync(agentsPath,agents);
let ignore=existsSync(ignorePath)?readFileSync(ignorePath,'utf8'):'';
if(!ignore.split(/\r?\n/).includes('.pstack/observability/')) {
  ignore+=`${ignore.endsWith('\n')?'':'\n'}\n# Local pstack run details — do not commit by default\n.pstack/observability/\n`;
  writeFileSync(ignorePath,ignore);
}
console.log(`Instrumented ${repo} at ${target}`);
console.log('Review changes in AGENTS.md, tools/pstack-observe.mjs and .gitignore before committing.');
console.log('No run started and no data uploaded.');
