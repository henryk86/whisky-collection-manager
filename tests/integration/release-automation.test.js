import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {classifyCommit,analyzeCommits,parseGitLog,notesForPlan} from '../../scripts/release-automation.js';

const run=(cwd,cmd,...args)=>execFileSync(cmd,args,{cwd,encoding:'utf8'}).trim();
const write=(dir,name,data)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
function fixture(t) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wcm-semrel-'));
    t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
    run(dir,'git','init','-b','main');
    run(dir,'git','config','user.name','Release Tester');
    run(dir,'git','config','user.email','tester@example.invalid');
    write(dir,'package.json',JSON.stringify({type:'module',version:'1.4.0'})+'\n');
    write(dir,'package-lock.json',JSON.stringify({version:'1.4.0',packages:{'':{version:'1.4.0'}}})+'\n');
    write(dir,'README.md','# Whisky Collection Manager v1.4.0\n');
    write(dir,'CHANGELOG.md','# Changelog\n\n## 1.4.0 - 2026-11-16\n\n- Baseline\n');
    write(dir,'docs/TESTSTATUS.md','# Teststatus - Whisky Collection Manager v1.4.0\n\n| `npm test` | **532/532 bestanden** | x |\n');
    write(dir,'docs/TESTHISTORIE.md','# Historie\n');
    fs.mkdirSync(path.join(dir,'scripts'),{recursive:true});
    for(const script of ['release-version.js','release-manifest.js','release-automation.js'])
        fs.copyFileSync(path.join('scripts',script),path.join(dir,'scripts',script));
    run(dir,'git','add','.');run(dir,'git','commit','-m','chore: start release test fixture');
    run(dir,'git','tag','v1.4.0');
    run(dir,'git','branch','develop');
    return dir;
}
function commit(dir,text,file='feature.txt') {
    write(dir,file,`${Math.random().toString(36).slice(2)}\n`);
    run(dir,'git','add','--',file);
    run(dir,'git','commit','-m',text);
}
function merge(dir){run(dir,'git','checkout','main');run(dir,'git','merge','--no-ff','develop','-m','Merge develop into main');}
function plan(dir){return JSON.parse(run(dir,process.execPath,'scripts/release-automation.js','plan','--json'));}
function snapshot(dir){const out=path.join(dir,'..',`${path.basename(dir)}-notes`);fs.mkdirSync(out,{recursive:true});return {out,result:run(dir,process.execPath,'scripts/release-automation.js','snapshot','--output',out)};}

test('Conventional Commits decide major > minor > patch; maintenance alone is one patch',()=>{
    assert.equal(classifyCommit('fix(warehouse): Umlagern korrigieren').level,'patch');
    assert.equal(classifyCommit('feat: tasting flights').level,'minor');
    assert.equal(classifyCommit('feat!: incompatible API').level,'major');
    assert.equal(classifyCommit('refactor(api): optimize storage').level,'none');
    assert.equal(classifyCommit('docs: improve handbook','BREAKING CHANGE: config changed').level,'major');
    assert.equal(analyzeCommits([{subject:'docs: handbook',sha:'1'},{subject:'test: coverage',sha:'2'}]).level,'patch');
    assert.equal(analyzeCommits([{subject:'fix: bug',sha:'1'},{subject:'feat: new page',sha:'2'}]).level,'minor');
    assert.throws(()=>classifyCommit('Update code'),/Conventional-Commit/);
    assert.throws(()=>classifyCommit('feat: '),/Conventional-Commit/);
    assert.deepEqual(parseGitLog('abc\0fix: x\0body\0\ndef\0feat: y\0\0\n'),[
        {sha:'abc',subject:'fix: x',body:'body'},{sha:'def',subject:'feat: y',body:''}
    ]);
    assert.match(notesForPlan({tag:'v1.5.0',previousTag:'v1.4.0',commits:[
        {...classifyCommit('feat(ui): new page'),sha:'abcdef01234'}]}),/feat\(ui\): new page/);
});

test('merge produces a versioned off-branch snapshot; next merge increments from tag, retry reuses it',t=>{
    const dir=fixture(t);
    run(dir,'git','checkout','develop');
    commit(dir,'fix(warehouse): change shelf');
    commit(dir,'feat(tasting): add option','tasting.txt');
    merge(dir);
    const mergeSha=run(dir,'git','rev-parse','HEAD');
    const first=plan(dir);
    assert.equal(first.version,'1.5.0');
    assert.equal(first.level,'minor');
    assert.equal(first.commits.length,2);
    snapshot(dir);
    const tagSha=run(dir,'git','rev-parse','v1.5.0^{commit}');
    assert.notEqual(tagSha,mergeSha);
    assert.equal(run(dir,'git','rev-parse','v1.5.0^'),mergeSha);
    assert.equal(run(dir,'git','rev-parse','main'),mergeSha);
    assert.equal(run(dir,'git','rev-parse','develop')!==mergeSha,true);
    assert.equal(JSON.parse(run(dir,'git','show','v1.5.0:package.json')).version,'1.5.0');
    assert.equal(JSON.parse(run(dir,'git','show','main:package.json')).version,'1.4.0');
    assert.match(run(dir,'git','show','v1.5.0:CHANGELOG.md'),/feat\(tasting\): add option/);
    run(dir,process.execPath,'scripts/release-version.js','check');
    run(dir,'git','checkout','main');
    assert.deepEqual(plan(dir),{head:mergeSha,version:'1.5.0',tag:'v1.5.0',previousTag:null,commits:[],level:'reuse',reuse:true,snapshot:tagSha});
    snapshot(dir); // no v1.5.1, no new branch commits
    assert.equal(run(dir,'git','rev-parse','main'),mergeSha);
    run(dir,'git','checkout','develop');
    commit(dir,'fix: repair import','import.txt');
    merge(dir);
    assert.equal(plan(dir).version,'1.5.1');
    snapshot(dir);
    assert.equal(run(dir,'git','rev-parse','v1.5.1^'),run(dir,'git','rev-parse','main'));
    const history=run(dir,'git','show','v1.5.1:CHANGELOG.md');
    assert.match(history,/## 1\.5\.1/);
    assert.match(history,/## 1\.5\.0/);
    assert.match(run(dir,'git','show','v1.5.1:docs/TESTHISTORIE.md'),/Testbericht v1\.5\.0/);
});

test('nonconventional commits fail instead of silently publishing an arbitrary version',t=>{
    const dir=fixture(t);
    run(dir,'git','checkout','develop');
    commit(dir,'plain commit message');
    assert.throws(()=>run(dir,process.execPath,'scripts/release-automation.js','validate','--range','main..develop'),/Command failed/);
    merge(dir);
    assert.throws(()=>plan(dir),/Command failed/);
});

test('a main fast-forward or direct push is not a permitted release trigger',t=>{
    const dir=fixture(t);
    commit(dir,'fix: direct main edit');
    assert.throws(()=>plan(dir),/Command failed/);
});
