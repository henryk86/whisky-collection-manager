#!/usr/bin/env node
/** Publish an approved release snapshot on main and synchronize develop.
 * Both refs are updated atomically. No force pushes, PR merges or data changes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {writeSourceManifest} from './release-manifest.js';
import {verifyReleaseMetadata} from './release-version.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const RELEASE_METADATA=[
    'package.json','package-lock.json','README.md','CHANGELOG.md',
    'docs/TESTSTATUS.md','docs/TESTHISTORIE.md','wcm-source-manifest.json'
];
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const gitAt=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const parents=rev=>git('rev-list','--parents','-n','1',rev).split(/\s+/).slice(1);
const ancestor=(older,newer)=>{
    try {git('merge-base','--is-ancestor',older,newer);return true;}
    catch {return false;}
};
const versionAt=ref=>JSON.parse(git('show',`${ref}:package.json`)).version;

/** Reject stale, moved or unrelated refs before attempting any remote update. */
export function releaseRefs({tag,merge}) {
    if(!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag))
        throw new Error(`Invalid release tag: ${tag}`);
    if(!/^[a-f0-9]{40}$/.test(merge)) throw new Error('Invalid approved merge SHA');
    const snapshot=git('rev-parse',`${tag}^{commit}`);
    if(parents(snapshot).length!==1 || parents(snapshot)[0]!==merge ||
        git('log','-1','--format=%s',snapshot)!==`WCM Release Snapshot ${tag}`)
        throw new Error('Tag does not reference the approved versioned release snapshot');
    if(versionAt(snapshot)!==tag.slice(1)) throw new Error('Tag and application version differ');
    if(parents(merge).length!==2) throw new Error('Release origin must be a two-parent merge');
    return {snapshot,developAtMerge:parents(merge)[1]};
}

function prepareDivergedDevelop({tip,base,snapshot,tag}) {
    if(!ancestor(base,tip)) throw new Error('develop was rewritten after the approved merge; refusing synchronization');
    // A change to a release metadata file after approval must not be discarded.
    const changed=git('diff','--name-only',`${base}..${tip}`,'--',...RELEASE_METADATA)
        .split('\n').filter(Boolean);
    if(changed.length) throw new Error(`develop changed release metadata since the merge: ${changed.join(', ')}. Manual resolution required.`);
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wcm-release-branch-'));
    let attached=false;
    try {
        git('worktree','add','--detach',temp,tip);
        attached=true;
        for(const file of RELEASE_METADATA) {
            fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});
            fs.writeFileSync(path.join(temp,file),execFileSync('git',['show',`${snapshot}:${file}`],{cwd:ROOT}));
        }
        // New application code on develop must receive a matching, freshly
        // computed source manifest rather than the snapshot's old hashes.
        writeSourceManifest(temp);
        verifyReleaseMetadata(temp);
        gitAt(temp,'add','--',...RELEASE_METADATA);
        if(gitAt(temp,'diff','--cached','--name-only')) {
            gitAt(temp,'-c','user.name=github-actions[bot]',
                '-c','user.email=41898282+github-actions[bot]@users.noreply.github.com',
                'commit','-m',`chore(release): synchronize ${tag} on develop`);
        }
        return gitAt(temp,'rev-parse','HEAD');
    } finally {
        if(attached) git('worktree','remove','--force',temp);
        fs.rmSync(temp,{recursive:true,force:true});
    }
}

export function synchronizeRelease({tag,merge}) {
    const {snapshot,developAtMerge}=releaseRefs({tag,merge});
    // Non-forced ref updates, atomic across both branches. GitHub's workflow
    // token writes do not trigger another push workflow (no release loop).
    git('fetch','--no-tags','origin',
        '+refs/heads/main:refs/remotes/origin/main',
        '+refs/heads/develop:refs/remotes/origin/develop');
    const main=git('rev-parse','refs/remotes/origin/main');
    const develop=git('rev-parse','refs/remotes/origin/develop');
    if(main!==merge && main!==snapshot)
        throw new Error('main has advanced beyond the approved release merge; refusing to overwrite it');
    let target;
    if(ancestor(develop,snapshot)) target=snapshot;
    else if(ancestor(snapshot,develop)) {
        // Already synchronized; more development commits can exist afterward.
        if(versionAt(develop)!==tag.slice(1))
            throw new Error('develop descends from this release but contains a different version');
        target=develop;
    } else {
        // A previous successful run may have synchronized a busy develop by
        // creating a metadata-only commit rather than fast-forwarding it.
        const subjects=git('log','--format=%s',`${developAtMerge}..${develop}`).split('\n');
        const synchronized=subjects.includes(`chore(release): synchronize ${tag} on develop`);
        if(synchronized && versionAt(develop)===tag.slice(1)) target=develop;
        else target=prepareDivergedDevelop({tip:develop,base:developAtMerge,snapshot,tag});
    }
    if(target!==develop && !ancestor(target,snapshot) && !ancestor(snapshot,target)) {
        // A metadata-only commit on a busy develop must not make the NEXT
        // develop -> main PR unmergeable (notably the source manifest).
        // merge-tree is a read-only preview, never an automated merge.
        try {git('merge-tree','--write-tree',snapshot,target);}
        catch {throw new Error('Version sync would cause conflicts on the next develop -> main merge. Resolve manually before publishing.');}
    }
    if(main===snapshot && develop===target) return {tag,main:snapshot,develop:target,unchanged:true};
    // This must be a single atomic update. Never fall back to two pushes:
    // one branch updated without the other would make versions inconsistent.
    git('push','--atomic','origin',
        `${snapshot}:refs/heads/main`,`${target}:refs/heads/develop`);
    return {tag,main:snapshot,develop:target,unchanged:false};
}

const running=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running) {
    try {
        const get=name=>process.argv[process.argv.indexOf(name)+1];
        if(!process.argv.includes('--tag') || !process.argv.includes('--merge'))
            throw new Error('Usage: sync-release-branches.js --tag vX.Y.Z --merge 40_HEX_SHA');
        const result=synchronizeRelease({tag:get('--tag'),merge:get('--merge')});
        console.log(JSON.stringify(result));
    } catch(error) {console.error(error.message);process.exitCode=1;}
}
