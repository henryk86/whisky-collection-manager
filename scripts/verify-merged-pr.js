#!/usr/bin/env node
/** Release gate for private GitHub repositories without enforced rulesets. */
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
async function main() {
    const sha=process.env.MERGE_SHA,repo=process.env.GITHUB_REPOSITORY;
    const chunks=[];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const lines=Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
    const prs=lines.map(line=>JSON.parse(line));
    verifyMergedPRs(prs,sha,repo);
    console.log(`Release source validated: ${sha.slice(0,12)} from develop -> main.`);
}
const isCLI=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCLI) main().catch(error=>{console.error(error.message);process.exitCode=1;});
