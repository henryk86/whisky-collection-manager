import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const sh=(cwd,...args)=>execFileSync(args[0],args.slice(1),{cwd,encoding:'utf8'}).trim();
const text=(dir,name,value)=>{const f=path.join(dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,value);};
const config=(dir)=>{
    sh(dir,'git','config','user.name','Release Test');
    sh(dir,'git','config','user.email','release@example.invalid');
};
function fixture(t,{moving=false,modifiedMetadata=false,minimalManifest=false}={}) {
    const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'wcm-branch-sync-'));
    t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
    const dir=path.join(tmp,'work'),remote=path.join(tmp,'remote.git');
    fs.mkdirSync(dir);sh(tmp,'git','init','--bare',remote);sh(dir,'git','init','-b','main');config(dir);
    for(const file of ['release-version.js','release-manifest.js','release-automation.js','sync-release-branches.js']) {
        const src=path.resolve('scripts',file);
        text(dir,`scripts/${file}`,fs.readFileSync(src,'utf8'));
    }
    text(dir,'package.json',JSON.stringify({name:'wcm-fixture',type:'module',version:'1.4.0'})+'\n');
    text(dir,'package-lock.json',JSON.stringify({version:'1.4.0',packages:{'':{version:'1.4.0'}}})+'\n');
    text(dir,'README.md','# Whisky Collection Manager v1.4.0\n\nIntroduction.\n');
    text(dir,'CHANGELOG.md','# Changelog\n\n## 1.4.0 - 2026-11-16\n\n- Historical information\n');
    text(dir,'docs/TESTSTATUS.md','# Teststatus - Whisky Collection Manager v1.4.0\n');
    text(dir,'docs/TESTHISTORIE.md','# Historical results v1.2.0\n');
    if(!minimalManifest) for(let i=0;i<20;i++) text(dir,`public/js/stable-${i}.js`,`export const stable${i} = ${i};\n`);
    sh(dir,process.execPath,'scripts/release-manifest.js','create');
    sh(dir,'git','add','.');sh(dir,'git','commit','-m','chore: baseline');
    sh(dir,'git','remote','add','origin',remote);
    sh(dir,'git','push','origin','main');
    sh(dir,'git','branch','develop');sh(dir,'git','push','origin','develop');
    sh(dir,'git','checkout','develop');
    text(dir,'feature.txt','approved functionality\n');
    sh(dir,'git','add','.');sh(dir,'git','commit','-m','fix: approved change');
    sh(dir,'git','push','origin','develop');
    sh(dir,'git','checkout','main');
    sh(dir,'git','merge','--no-ff','develop','-m','Merge pull request from develop');
    const merge=sh(dir,'git','rev-parse','HEAD');
    sh(dir,'git','push','origin','main');
    sh(dir,'git','checkout','--detach',merge);
    text(dir,'package.json',JSON.stringify({name:'wcm-fixture',type:'module',version:'1.4.1'})+'\n');
    text(dir,'package-lock.json',JSON.stringify({version:'1.4.1',packages:{'':{version:'1.4.1'}}})+'\n');
    text(dir,'README.md','# Whisky Collection Manager v1.4.1\n\nIntroduction.\n');
    text(dir,'CHANGELOG.md','# Changelog\n\n## 1.4.1 - 2026-11-16\n\n- fix: approved change\n\n## 1.4.0 - 2026-11-16\n\n- Historical information\n');
    text(dir,'docs/TESTSTATUS.md','# Teststatus - Whisky Collection Manager v1.4.1\n\nRelease CI pending\n');
    sh(dir,process.execPath,'scripts/release-manifest.js','create');
    sh(dir,'git','add','.');sh(dir,'git','commit','-m','WCM Release Snapshot v1.4.1');
    const snapshot=sh(dir,'git','rev-parse','HEAD');
    sh(dir,'git','tag','v1.4.1');sh(dir,'git','push','origin','refs/tags/v1.4.1');
    if(moving || modifiedMetadata) {
        sh(dir,'git','checkout','develop');
        text(dir,'public/js/new-feature.js','export const next = true;\n');
        if(modifiedMetadata) text(dir,'README.md','# Locally revised readme v1.4.0\n');
        sh(dir,'git','add','.');sh(dir,'git','commit','-m','feat: next changes while release builds');
        sh(dir,'git','push','origin','develop');
    }
    return {dir,remote,merge,snapshot};
}
function sync({dir,merge}) {
    return JSON.parse(sh(dir,process.execPath,'scripts/sync-release-branches.js','--tag','v1.4.1','--merge',merge));
}
const get=(dir,branch,name)=>sh(dir,'git','show',`refs/remotes/origin/${branch}:${name}`);
const remoteRef=(dir,branch)=>sh(dir,'git','ls-remote','origin',`refs/heads/${branch}`).split(/\s+/)[0];

test('release snapshot atomically advances main and develop, including footer and Markdown metadata',t=>{
    const state=fixture(t),{dir,merge,snapshot}=state;
    const result=sync(state);
    assert.equal(result.main,snapshot);
    assert.equal(result.develop,snapshot);
    assert.equal(remoteRef(dir,'main'),snapshot);
    assert.equal(remoteRef(dir,'develop'),snapshot);
    sh(dir,'git','fetch','origin');
    for(const branch of ['main','develop']) {
        assert.equal(JSON.parse(get(dir,branch,'package.json')).version,'1.4.1');
        assert.equal(JSON.parse(get(dir,branch,'package-lock.json')).version,'1.4.1');
        assert.match(get(dir,branch,'README.md'),/^# Whisky Collection Manager v1\.4\.1/);
        assert.match(get(dir,branch,'docs/TESTSTATUS.md'),/v1\.4\.1/);
        assert.match(get(dir,branch,'CHANGELOG.md'),/## 1\.4\.1/);
        assert.match(get(dir,branch,'CHANGELOG.md'),/## 1\.4\.0/);
        assert.equal(JSON.parse(get(dir,branch,'wcm-source-manifest.json')).version,'1.4.1');
    }
    assert.equal(sync(state).unchanged,true);
    assert.equal(remoteRef(dir,'main'),snapshot);
});

test('develop may advance while release builds; new source is retained and manifest recalculated',t=>{
    const state=fixture(t,{moving:true}),{dir,snapshot}=state;
    const before=remoteRef(dir,'develop');
    const result=sync(state);
    assert.equal(result.main,snapshot);
    assert.notEqual(result.develop,before);
    sh(dir,'git','fetch','origin');
    assert.match(get(dir,'develop','public/js/new-feature.js'),/next = true/);
    assert.equal(JSON.parse(get(dir,'develop','package.json')).version,'1.4.1');
    const manifest=JSON.parse(get(dir,'develop','wcm-source-manifest.json'));
    assert.ok(manifest.files['public/js/new-feature.js']);
    assert.match(sh(dir,'git','show','refs/remotes/origin/develop:CHANGELOG.md'),/## 1\.4\.0/);
    assert.equal(sync(state).unchanged,true);
});

test('metadata edits made after release merge fail safely before either branch is updated',t=>{
    const state=fixture(t,{modifiedMetadata:true});
    const beforeMain=remoteRef(state.dir,'main');
    const beforeDev=remoteRef(state.dir,'develop');
    assert.throws(()=>sh(state.dir,process.execPath,'scripts/sync-release-branches.js',
        '--tag','v1.4.1','--merge',state.merge),/Command failed/);
    assert.equal(remoteRef(state.dir,'main'),beforeMain);
    assert.equal(remoteRef(state.dir,'develop'),beforeDev);
});

test('invalid tag or changed main is rejected without any branch updates',t=>{
    const state=fixture(t);
    assert.throws(()=>sh(state.dir,process.execPath,'scripts/sync-release-branches.js',
        '--tag','v1.4.1','--merge','0'.repeat(40)),/Command failed/);
    const beforeDev=remoteRef(state.dir,'develop');
    sh(state.dir,'git','checkout','main');
    text(state.dir,'unapproved.txt','new main change\n');
    sh(state.dir,'git','add','.');sh(state.dir,'git','commit','-m','fix: direct push to main');
    sh(state.dir,'git','push','origin','main');
    assert.throws(()=>sh(state.dir,process.execPath,'scripts/sync-release-branches.js',
        '--tag','v1.4.1','--merge',state.merge),/Command failed/);
    assert.equal(remoteRef(state.dir,'develop'),beforeDev);
});

test('a second release after both branches were fast-forwarded computes one new minor bump',t=>{
    const state=fixture(t),{dir}=state;
    sync(state);
    sh(dir,'git','fetch','origin');
    sh(dir,'git','checkout','-B','develop','refs/remotes/origin/develop');
    text(dir,'following-feature.txt','another feature\n');
    sh(dir,'git','add','.');sh(dir,'git','commit','-m','feat: next release feature');
    sh(dir,'git','push','origin','develop');
    sh(dir,'git','checkout','-B','main','refs/remotes/origin/main');
    sh(dir,'git','merge','--no-ff','develop','-m','Merge develop into main');
    const result=JSON.parse(sh(dir,process.execPath,'scripts/release-automation.js','plan','--json'));
    assert.equal(result.version,'1.5.0');
    assert.equal(result.level,'minor');
    assert.deepEqual(result.commits.map(c=>c.subject),['feat: next release feature']);
});

test('a later release can merge develop after its in-flight changes were synchronized',t=>{
    const state=fixture(t,{moving:true}),{dir}=state;
    sync(state);
    sh(dir,'git','fetch','origin');
    sh(dir,'git','checkout','-B','develop','refs/remotes/origin/develop');
    text(dir,'next.txt','new fix\n');
    sh(dir,'git','add','.');sh(dir,'git','commit','-m','fix: additional work');
    sh(dir,'git','push','origin','develop');
    sh(dir,'git','checkout','-B','main','refs/remotes/origin/main');
    try{sh(dir,'git','merge','--no-ff','develop','-m','Merge develop into main');}
    catch(e){console.error('CONFLICTS',sh(dir,'git','diff','--name-only','--diff-filter=U'));throw e;}
    const result=JSON.parse(sh(dir,process.execPath,'scripts/release-automation.js','plan','--json'));
    assert.equal(result.version,'1.5.0'); // the in-flight feat: next changes triggers minor
    assert.ok(result.commits.some(c=>c.subject==='feat: next changes while release builds'));
});

test('synchronization refuses a prospective source-manifest merge conflict',t=>{
    const state=fixture(t,{moving:true,minimalManifest:true});
    const beforeMain=remoteRef(state.dir,'main');
    const beforeDev=remoteRef(state.dir,'develop');
    assert.throws(()=>sh(state.dir,process.execPath,'scripts/sync-release-branches.js',
        '--tag','v1.4.1','--merge',state.merge),/Command failed/);
    assert.equal(remoteRef(state.dir,'main'),beforeMain);
    assert.equal(remoteRef(state.dir,'develop'),beforeDev);
});
