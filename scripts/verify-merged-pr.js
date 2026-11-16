#!/usr/bin/env node
/** Release gate: only approved develop merges publish, version PR merges are ignored. */
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function isApprovedReleaseMerge(pr,sha,repo) {
    return /^[a-f0-9]{40}$/.test(sha||'') && typeof repo==='string' && repo.includes('/')
        && pr?.merged_at != null
        && pr.merge_commit_sha===sha
        && pr.base?.ref==='main' && pr.head?.ref==='develop'
        && pr.base?.repo?.full_name===repo && pr.head?.repo?.full_name===repo;
}
export function verifyMergedPRs(prs,sha,repo) {
    if(!Array.isArray(prs) || !prs.some(pr=>isApprovedReleaseMerge(pr,sha,repo)))
        throw new Error('Release blocked: no merged develop -> main PR matches this commit and repository.');
    return true;
}
export function approvedVersionMerge(pr,sha,repo) {
    return /^[a-f0-9]{40}$/.test(sha||'') && pr?.merged_at != null
        && pr.merge_commit_sha===sha && pr.base?.ref==='main'
        && pr.base?.repo?.full_name===repo && pr.head?.repo?.full_name===repo
        && /^release\/version-v\d+\.\d+\.\d+$/.test(pr.head?.ref||'')
        && ['github-actions[bot]',repo?.split('/')[0]].includes(pr.user?.login)
        && pr.title===`chore(release): synchronize ${pr.head.ref.slice('release/version-'.length)}`;
}
export function verifyMainMerge(prs,sha,repo) {
    if(!Array.isArray(prs)) throw new Error('Invalid PR response');
    if(prs.some(pr=>isApprovedReleaseMerge(pr,sha,repo))) return 'release';
    if(prs.some(pr=>approvedVersionMerge(pr,sha,repo))) return 'version-sync';
    throw new Error('Main push denied: neither a develop release merge nor an approved version PR.');
}
async function main() {
    const sha=process.env.MERGE_SHA,repo=process.env.GITHUB_REPOSITORY;
    const chunks=[];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const lines=Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
    const prs=lines.map(line=>JSON.parse(line));
    const kind=verifyMainMerge(prs,sha,repo);
    if(process.argv.includes('--require-release') && kind!=='release')
        throw new Error('Recovery must originate from a manually approved develop -> main merge');
    if(kind==='version-sync') {
        // Verify the GitHub API's PR origin against the real Git ancestry and tag.
        const pr=prs.find(p=>approvedVersionMerge(p,sha,repo));
        const {execFileSync}=await import('node:child_process');
        const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
        const tag=pr.head.ref.slice('release/version-'.length);
        const snapshot=git('rev-parse',`${tag}^{commit}`);
        const parents=git('rev-list','--parents','-n','1',sha).split(/\s+/).slice(1);
        const snapshotParent=git('rev-parse',`${snapshot}^`);
        if(pr.head.sha!==snapshot || parents.length!==2 || parents[0]!==snapshotParent || parents[1]!==snapshot)
            throw new Error('Version merge is not the expected release snapshot PR');
    }
    if(process.env.GITHUB_OUTPUT)
        (await import('node:fs')).appendFileSync(process.env.GITHUB_OUTPUT,`kind=${kind}\n`);
    console.log(`Main merge validated: ${kind} ${sha.slice(0,12)}.`);
}
const isCLI=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCLI) main().catch(error=>{console.error(error.message);process.exitCode=1;});
