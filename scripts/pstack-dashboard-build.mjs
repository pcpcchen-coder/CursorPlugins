#!/usr/bin/env node
/** Build a static index of self-reported pstack runs (no GitHub/network dependency). */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(ROOT, 'dashboard');
const runsDir = join(webRoot, 'data', 'runs');
const allowed = new Set(['running','passed','failed','blocked','cancelled']);
const allowedStep = new Set(['pending','running','passed','failed','blocked','skipped']);
const errors = [];
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : (e.name.endsWith('.json') ? [join(dir, e.name)] : []));
}
const registry = JSON.parse(readFileSync(join(webRoot,'projects.json'),'utf8'));
if (!Array.isArray(registry.projects)) throw new Error('projects.json must contain projects[]');
const names = new Set();
for (const p of registry.projects) {
  if (typeof p.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(p.repo) || names.has(p.repo)) errors.push(`invalid/duplicate registry repo: ${p.repo}`);
  names.add(p.repo);
}
const runs = [];
for (const path of walk(runsDir)) {
  try {
    const r = JSON.parse(readFileSync(path,'utf8'));
    const rel = relative(runsDir, path).split(sep).join('/');
    const expected = `${r.repo}/${r.run_id}.json`;
    if (rel !== expected || !/^[\w.-]+\/[\w.-]+$/.test(r.repo) || !/^[\w.-]+$/.test(r.run_id)) throw new Error(`unexpected path vs run ID: ${rel}`);
    if (r.schema_version !== 1 || !allowed.has(r.status)) throw new Error('schema_version/status not supported');
    if (!Array.isArray(r.steps) || r.steps.length > 40 || r.steps.some(s=> !allowedStep.has(s.status) || typeof s.id !== 'string')) throw new Error('invalid steps');
    if (!Array.isArray(r.events) || r.events.length > 200) throw new Error('invalid events');
    if (!Number.isFinite(Date.parse(r.updated_at))) throw new Error('invalid updated_at');
    const {repo, run_id, title, playbook, status, updated_at, started_at, ended_at, branch, commit_sha} = r;
    runs.push({ repo, run_id, title, playbook, status, updated_at, started_at, ended_at,
      branch, commit_sha, passed_steps: r.steps.filter(s=>s.status==='passed').length, total_steps:r.steps.length,
      path: `data/runs/${rel}` });
  } catch(e) { errors.push(`${path}: ${e.message}`); }
}
if (errors.length) { errors.forEach(e=>console.error('FAIL',e)); process.exit(1); }
runs.sort((a,b)=>b.updated_at.localeCompare(a.updated_at) || a.run_id.localeCompare(b.run_id));
const out = { schema_version: 1, generated_at: runs[0]?.updated_at || null, projects:registry.projects, runs };
writeFileSync(join(webRoot,'data','index.json'),JSON.stringify(out,null,2)+'\n');
console.log(`PASS dashboard index: ${runs.length} runs, ${registry.projects.length} registered projects`);
