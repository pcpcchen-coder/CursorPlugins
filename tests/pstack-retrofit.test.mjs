import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const script=join(root,'scripts','pstack-observer-install.mjs');
function sample(){
 const dir=mkdtempSync(join(tmpdir(),'pstack-legacy-'));mkdirSync(join(dir,'.git'));
 writeFileSync(join(dir,'AGENTS.md'),'# Existing project agent policy\n');return dir;
}
const run=(dir,...args)=>spawnSync(process.execPath,[script,'--target',dir,'--repo','pcpcchen-coder/TestRepo',...args],{encoding:'utf8'});
test('retrofit dry-run leaves legacy project untouched',()=>{
 const dir=sample(),start=readFileSync(join(dir,'AGENTS.md'),'utf8');
 const result=run(dir,'--dry-run');assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/DRY RUN/);assert.equal(readFileSync(join(dir,'AGENTS.md'),'utf8'),start);
 assert.ok(!existsSync(join(dir,'tools','pstack-observe.mjs')));
});
test('retrofit is idempotent and preserves existing instructions',()=>{
 const dir=sample();assert.equal(run(dir).status,0);
 const text=readFileSync(join(dir,'AGENTS.md'),'utf8');
 assert.match(text,/^# Existing project agent policy/);
 assert.equal(text.split('PSTACK_OBSERVABILITY_BEGIN').length-1,1);
 assert.equal(run(dir).status,0);assert.equal(readFileSync(join(dir,'AGENTS.md'),'utf8'),text);
 assert.ok(readFileSync(join(dir,'.gitignore'),'utf8').includes('.pstack/observability/'));
});
test('custom observer instructions and modified Recorder are not overwritten',()=>{
 const dir=sample();
 const original='# Keep me\n<!-- PSTACK_OBSERVABILITY_BEGIN -->\nSpecial project rule\n<!-- PSTACK_OBSERVABILITY_END -->\n';
 writeFileSync(join(dir,'AGENTS.md'),original);
 assert.equal(run(dir).status,0);assert.equal(readFileSync(join(dir,'AGENTS.md'),'utf8'),original);
 writeFileSync(join(dir,'tools','pstack-observe.mjs'),'// locally edited tool\n');
 const refused=run(dir);assert.notEqual(refused.status,0);assert.match(refused.stderr,/Refusing to overwrite/);
});
