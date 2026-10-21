import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const recorder=join(root,'scripts','pstack-observe.mjs');
const installer=join(root,'scripts','pstack-observer-install.mjs');
const builder=join(root,'scripts','pstack-dashboard-build.mjs');
const workspace=()=>mkdtempSync(join(tmpdir(),'pstack-test-'));
function run(script,args,env={}){
  return spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,...env}});
}
function snapshot(work,id){return JSON.parse(readFileSync(join(work,'.pstack','observability','runs',`${id}.json`),'utf8'));}
test('run lifecycle retains steps, evidence, events and refuses premature pass',()=>{
  const w=workspace(), id='test-42';
  const start=run(recorder,['start','--workspace',w,'--repo','pcpcchen-coder/AIOS','--run',id,'--title','Fix bug','--steps','reproduce,fix,verify']);
  assert.equal(start.status,0,start.stderr);assert.match(start.stdout,/RUN_ID=test-42/);
  assert.notEqual(run(recorder,['finish','--workspace',w,'--run',id,'--status','passed']).status,0);
  for(const step of ['reproduce','fix','verify']){
    assert.equal(run(recorder,['step','--workspace',w,'--run',id,'--step',step,'--status','running']).status,0);
    assert.equal(run(recorder,['step','--workspace',w,'--run',id,'--step',step,'--status','passed','--note','Passed test','--evidence','https://github.com/pcpcchen-coder/AIOS/actions']).status,0);
  }
  assert.equal(run(recorder,['finish','--workspace',w,'--run',id,'--status','passed']).status,0);
  const snap=snapshot(w,id);assert.equal(snap.status,'passed');assert.equal(snap.steps.length,3);assert.equal(snap.events.length,8);
  assert.equal(snap.steps[0].evidence[0].url,'https://github.com/pcpcchen-coder/AIOS/actions');
  assert.notEqual(run(recorder,['step','--workspace',w,'--run',id,'--step','fix','--status','running']).status,0);
});
test('recorder blocks traversal, malformed repo and unacknowledged publication',()=>{
  const w=workspace();
  assert.notEqual(run(recorder,['start','--workspace',w,'--repo','../bad','--title','bad']).status,0);
  assert.notEqual(run(recorder,['start','--workspace',w,'--repo','pcpcchen-coder/AIOS','--run','../oops']).status,0);
  assert.equal(run(recorder,['start','--workspace',w,'--repo','pcpcchen-coder/AIOS','--run','safe','--steps','test']).status,0);
  assert.notEqual(run(recorder,['publish','--workspace',w,'--run','safe','--public-ok']).status,0);
  assert.notEqual(run(recorder,['publish','--workspace',w,'--run','safe'],{'PSTACK_OBSERVE_PUBLICATION_ACK':'1'}).status,0);
  assert.notEqual(run(recorder,['step','--workspace',w,'--run','safe','--step','test','--status','passed','--evidence','javascript:alert(1)']).status,0);
});
test('installer adds instructions without overwriting project existing policy',()=>{
  const w=workspace();mkdirSync(join(w,'.git'));writeFileSync(join(w,'AGENTS.md'),'# Existing\nDo not remove.\n');
  const install=()=>run(installer,['--target',w,'--repo','pcpcchen-coder/AIOS']);
  assert.equal(install().status,0);assert.equal(install().status,0);
  const policy=readFileSync(join(w,'AGENTS.md'),'utf8');assert.ok(policy.startsWith('# Existing\nDo not remove.'));
  assert.equal(policy.split('PSTACK_OBSERVABILITY_BEGIN').length-1,1);
  assert.ok(existsSync(join(w,'tools','pstack-observe.mjs')));
  assert.ok(readFileSync(join(w,'.gitignore'),'utf8').includes('.pstack/observability/'));
});
test('index build succeeds on current repository and is deterministic',()=>{
  const a=run(builder,[]);assert.equal(a.status,0,a.stderr);
  const idx=readFileSync(join(root,'dashboard','data','index.json'),'utf8');
  const b=run(builder,[]);assert.equal(b.status,0,b.stderr);
  assert.equal(readFileSync(join(root,'dashboard','data','index.json'),'utf8'),idx);
});

test('AIOS registry identifies local-only installation without pretending to report runs',()=>{
  const registry=JSON.parse(readFileSync(join(root,'dashboard','projects.json'),'utf8'));
  const aios=registry.projects.find(p=>p.repo==='pcpcchen-coder/AIOS');
  assert.equal(aios.observer_status,'installed-local-only');
  assert.match(aios.observer_ci_url,/^https:\/\/github\.com\/pcpcchen-coder\/AIOS\/actions\/runs\/\d+$/);
  const check=run(builder,[]);assert.equal(check.status,0,check.stderr);
  const built=JSON.parse(readFileSync(join(root,'dashboard','data','index.json'),'utf8'));
  assert.equal(built.projects.find(p=>p.repo===aios.repo).observer_status,'installed-local-only');
});
