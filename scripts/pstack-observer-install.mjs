#!/usr/bin/env node
// Idempotent retrofit for existing pstack repos; never rewrites original skill/vendor files.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const param=name=>{const p=args.indexOf('--'+name);return p===-1?null:args[p+1];};
const where=param('target'),repo=param('repo'),dry=args.includes('--dry-run');
if(!where||!/^[\w.-]+\/[\w.-]+$/.test(repo||'')){
 console.error('Usage: node scripts/pstack-observer-install.mjs --target ../ExistingRepo --repo owner/repo [--dry-run]');process.exit(2);
}
const path=resolve(where);
if(!existsSync(join(path,'.git'))){console.error('Existing Git checkout is required');process.exit(2);}
const tool=join(path,'tools','pstack-observe.mjs');
const source=join(root,'scripts','pstack-observe.mjs');
const agentFile=join(path,'AGENTS.md'),ignoreFile=join(path,'.gitignore');
if(!existsSync(source))throw Error('Bundled Recorder missing');
if(existsSync(tool)&&readFileSync(tool,'utf8')!==readFileSync(source,'utf8')){
 console.error('Refusing to overwrite a customized Recorder: '+tool);process.exit(1);
}
const begin='<!-- PSTACK_OBSERVABILITY_BEGIN -->',end='<!-- PSTACK_OBSERVABILITY_END -->';
const code=[
begin,'## Optional pstack sidecar observability','',
'Keep the existing project pstack configuration, rules and vendor locks unchanged.',
'For actual pstack work, record each stage by running the project-local Recorder:',
'',
'    node tools/pstack-observe.mjs start --repo '+repo+' --title "Task" --playbook investigation --steps "inspect,verify,report"',
'    node tools/pstack-observe.mjs step --run RUN_ID --step inspect --status running',
'    node tools/pstack-observe.mjs step --run RUN_ID --step inspect --status passed --note "Observed work"',
'    node tools/pstack-observe.mjs finish --run RUN_ID --status passed',
'',
'Use the stable RUN_ID returned by start. Never claim a step passed before its evidence.',
'Record failures and unavailable tools. The script is not a passive IDE-level hook.',
'Local .pstack/observability/ files are ignored; nothing publishes automatically.',
'Public publishing requires explicit project owner approval, --public-ok and',
'PSTACK_OBSERVE_PUBLICATION_ACK=1. Exclude all secrets, personal data and private transcripts.',
end,''
].join('\n');
const ag0=existsSync(agentFile)?readFileSync(agentFile,'utf8'):'';
const ig0=existsSync(ignoreFile)?readFileSync(ignoreFile,'utf8'):'';
let ag=ag0;
if(ag0.includes(begin)||ag0.includes(end)){
 const i=ag0.indexOf(begin),j=ag0.indexOf(end);
 if(i<0||j<i)throw Error('Incomplete observer marker; manual inspection required');
 console.log('Existing observer section preserved unchanged (including project customizations).');
}else ag+=((ag.endsWith('\n')?'':'\n')+'\n'+code);
let ig=ig0;
if(!ig0.split(/\r?\n/).includes('.pstack/observability/')){
 ig+=(ig.endsWith('\n')?'':'\n')+'\n# Local pstack observability, not publicly uploaded by default\n.pstack/observability/\n';
}
const detected=['vendor/pstack/skills/poteto-mode/SKILL.md','.cursor/skills/poteto-mode/SKILL.md','.agents/skills/poteto-mode/SKILL.md']
  .filter(item=>existsSync(join(path,item)));
console.log('Existing pstack entrypoints: '+(detected.join(', ')||'not found; plugin installation may be external'));
if(dry){
 console.log('DRY RUN: Recorder '+(existsSync(tool)?'already exists':'would be copied')+'; AGENTS.md '+(ag===ag0?'unchanged':'would update')+'; .gitignore '+(ig===ig0?'unchanged':'would update'));
 console.log('No changes or network calls made.');process.exit(0);
}
mkdirSync(dirname(tool),{recursive:true});
copyFileSync(source,tool);
if(ag!==ag0)writeFileSync(agentFile,ag);
if(ig!==ig0)writeFileSync(ignoreFile,ig);
console.log('Installed pstack Recorder for '+repo+'. Review git diff before committing. No telemetry published.');
