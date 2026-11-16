#!/usr/bin/env node
/** Automatic release planning from Conventional Commits; never writes main/develop. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compareVersions,nextVersion,parseVersion,applyAutomatedRelease,verifyReleaseMetadata} from './release-version.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const TYPES=new Set(['fix','feat','perf','revert','refactor','docs','test','ci','build','chore','style']);
const LABELS={major:'Inkompatible Aenderungen',minor:'Neue Funktionen',patch:'Fehlerbehebungen und Verbesserungen',none:'Wartung und Dokumentation'};

export function classifyCommit(subject,body='') {
    const match=/^([a-z]+)(?:\(([a-z\d._/-]+)\))?(!)?: (\S.+|\S)$/.exec(subject.trim());
    if(!match || !TYPES.has(match[1])) throw new Error(`Commit ohne gueltigen Conventional-Commit-Typ: ${subject}`);
    const [,type,scope,breaking,description]=match;
    if(description.length>180) throw new Error(`Commit-Beschreibung zu lang: ${subject}`);
    const isBreaking=Boolean(breaking) || /^BREAKING(?:-| )CHANGE:\s*\S/m.test(body);
    const level=isBreaking?'major':type==='feat'?'minor':['fix','perf','revert'].includes(type)?'patch':'none';
    return {type,scope:scope||'',description,subject,level};
}
export function analyzeCommits(commits) {
    if(!commits.length) throw new Error('Seit dem letzten Release sind keine neuen Commits vorhanden.');
    const parsed=commits.map(commit=>({...classifyCommit(commit.subject,commit.body||''),sha:commit.sha}));
    const level=parsed.some(c=>c.level==='major')?'major':parsed.some(c=>c.level==='minor')?'minor':'patch';
    return {level,commits:parsed};
}
export function parseGitLog(output) {
    const parts=output.split('\0');
    const commits=[];
    for(let i=0;i+2<parts.length;i+=3) {
        const sha=parts[i].trim(),subject=parts[i+1].trim(),body=parts[i+2].trim();
        if(sha) commits.push({sha,subject,body});
    }
    return commits;
}
export function notesForPlan(plan) {
    const rows=[`# ${plan.tag}`, '', `Automatisch aus den Commits seit ${plan.previousTag||'dem letzten Versionsstand'} ermittelt.`, ''];
    if(plan.ignoredLegacyCommits) rows.push(`${plan.ignoredLegacyCommits} historische Commits vor Einfuehrung der Commit-Konvention wurden nicht erneut klassifiziert.`, '');
    for(const [level,title] of Object.entries(LABELS)) {
        const subset=plan.commits.filter(c=>c.level===level);
        if(!subset.length) continue;
        rows.push(`## ${title}`,'');
        for(const commit of subset) rows.push(`- ${commit.subject.replace(/[\r\n]/g,' ')} (${commit.sha.slice(0,7)})`);
        rows.push('');
    }
    return rows.join('\n').trimEnd()+'\n';
}
const gitExists=(ref)=>{try{execFileSync('git',['rev-parse','--verify',`${ref}^{commit}`],{cwd:ROOT,stdio:'ignore'});return true;}catch{return false;}};
const isAncestor=(ancestor,head)=>{try{execFileSync('git',['merge-base','--is-ancestor',ancestor,head],{cwd:ROOT,stdio:'ignore'});return true;}catch{return false;}};
const commitParents=(rev)=>git('rev-list','--parents','-n','1',rev).split(/\s+/).slice(1);
const hasFileAt=(ref,name)=>{try{execFileSync('git',['cat-file','-e',`${ref}:${name}`],{cwd:ROOT,stdio:'ignore'});return true;}catch{return false;}};

/** A release-snapshot tag has an off-branch commit whose sole parent is the main merge. */
function knownReleases(head) {
    const refs=git('tag','--list','v*').split(/\s+/).filter(x=>/^v\d+\.\d+\.\d+$/.test(x));
    return refs.flatMap(tag=>{
        const sha=git('rev-parse',`${tag}^{commit}`);
        const parents=commitParents(sha);
        const snapshot=git('show','-s','--format=%s',sha)===`WCM Release Snapshot ${tag}`;
        const anchor=snapshot?(parents.length===1?parents[0]:null):sha;
        return anchor && isAncestor(anchor,head)?[{tag,version:tag.slice(1),sha,anchor,snapshot}]:[];
    }).sort((a,b)=>compareVersions(b.version,a.version));
}

export function planRelease({head='HEAD',requireMerge=true}={}) {
    const sha=git('rev-parse',head);
    const parents=commitParents(sha);
    if(requireMerge && parents.length!==2) throw new Error('main darf nur ueber einen Merge-Commit aus develop veroeffentlicht werden (kein Squash oder Direktpush).');
    const releases=knownReleases(sha),latest=releases[0];
    // Re-running the exact push must reuse its snapshot/tag, not bump twice.
    if(latest?.snapshot && latest.anchor===sha) {
        return {head:sha,version:latest.version,tag:latest.tag,previousTag:null,commits:[],level:'reuse',reuse:true,snapshot:latest.sha};
    }
    const baseline=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;
    parseVersion(baseline);
    // The first merge after installing this automation may legitimately bring
    // the last manually maintained version from develop (e.g. 1.4.0 while
    // main still contains 1.3.x). This is NOT a new manual bump. Allow it
    // exactly once, when the automation script did not exist on main before
    // this merge. All later merges must leave the checked-in version alone.
    const beforeVersion=JSON.parse(git('show',`${parents[0]}:package.json`)).version;
    const introducingAutomation=!hasFileAt(parents[0],'scripts/release-automation.js')
        && hasFileAt(sha,'scripts/release-automation.js');
    const legacyTransition=baseline!==beforeVersion && introducingAutomation
        && !releases.some(release=>release.snapshot)
        && compareVersions(baseline,beforeVersion)>0;
    if(baseline!==beforeVersion && !legacyTransition)
        throw new Error('Keine manuellen Versionsspruenge auf develop: das Release wird nach dem main-Merge versioniert.');
    if(legacyTransition) {
        // Only accept the old, fully synchronized release metadata, not an
        // arbitrary package.json version inserted into the merge.
        // Do not run release:check on a development checkout: its source
        // manifest intentionally reflects the previous packaged release.
        const lock=JSON.parse(fs.readFileSync(path.join(ROOT,'package-lock.json'),'utf8'));
        const readme=fs.readFileSync(path.join(ROOT,'README.md'),'utf8');
        const changelog=fs.readFileSync(path.join(ROOT,'CHANGELOG.md'),'utf8');
        if(lock.version!==baseline || lock.packages?.['']?.version!==baseline
            || !readme.includes(`Whisky Collection Manager v${baseline}`)
            || !changelog.includes(`## ${baseline} -`))
            throw new Error('Vorhandene Versionsmetadaten beim einmaligen Automatik-Umstieg sind inkonsistent.');
    }
    if(latest && compareVersions(baseline,latest.version)<0 && !latest.snapshot)
        throw new Error('Entwicklungs-Version ist aelter als der letzte erreichbare Release-Tag.');
    // During the transition, the checked-in 1.4.0 may be newer than the
    // latest reachable tag. Never downgrade it to a 1.3.x release.
    const current=latest && compareVersions(latest.version,baseline)>0 ? latest.version : baseline;
    // If no tags exist (one-time transition), limit to commits introduced by this main merge.
    const from=latest?.anchor || parents[0];
    if(!from || !isAncestor(from,sha) || from===sha) throw new Error('Kein neuer develop-Stand seit dem letzten Release.');
    let commits=parseGitLog(git('log','--no-merges','--format=%H%x00%s%x00%b%x00',`${from}..${sha}`));
    let ignoredLegacyCommits=0;
    if(introducingAutomation) {
        // On the first main merge, the range still contains commits created
        // before Conventional Commits were required. Do NOT rewrite history or
        // silently exempt commits made after the automation was introduced.
        // The commit which first adds this script is the exact policy cutover.
        const additions=git('log','--diff-filter=A','--reverse','--format=%H',
            `${from}..${sha}`,'--','scripts/release-automation.js').split(/\s+/).filter(Boolean);
        if(additions.length!==1) throw new Error('Der Einfuehrungs-Commit der Release-Automatik ist nicht eindeutig ermittelbar.');
        const cutoverIndex=commits.findIndex(commit=>commit.sha===additions[0]);
        if(cutoverIndex<0) throw new Error('Der Einfuehrungs-Commit muss ein eigener Nicht-Merge-Commit sein.');
        ignoredLegacyCommits=commits.length-cutoverIndex-1;
        commits=commits.slice(0,cutoverIndex+1);
    }
    const analysis=analyzeCommits(commits);
    const version=nextVersion(current,analysis.level),tag=`v${version}`;
    if(releases.some(release=>compareVersions(version,release.version)<=0) || gitExists(`refs/tags/${tag}`)) {
        throw new Error(`Tag ${tag} existiert bereits oder ist nicht neuer als die vorhandenen Releases.`);
    }
    return {head:sha,version,tag,previousTag:latest?.tag||`v${current}`,level:analysis.level,commits:analysis.commits,reuse:false,legacyTransition,ignoredLegacyCommits};
}
function parseOption(args,name) {const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
function validateRange(range) {
    if(!range || !/^[a-zA-Z0-9_./~^{}-]+\.\.[a-zA-Z0-9_./~^{}-]+$/.test(range))
        throw new Error('Commit-Validierung erfordert --range BASE..HEAD');
    const commits=parseGitLog(git('log','--no-merges','--format=%H%x00%s%x00%b%x00',range));
    for(const commit of commits) classifyCommit(commit.subject,commit.body);
    console.log(`${commits.length} Conventional Commits: OK`);
}

function main() {
    const [, ,command,...args]=process.argv;
    if(command==='validate') {validateRange(parseOption(args,'--range'));return;}
    if(!['plan','snapshot'].includes(command)) throw new Error('Usage: release-automation.js validate --range BASE..HEAD | plan [--json] | snapshot --output DIR');
    const plan=planRelease();
    if(command==='plan') {
        if(args.includes('--json')) console.log(JSON.stringify(plan));
        else console.log(`${plan.tag} (${plan.level}; ${plan.commits.length} Commits${plan.ignoredLegacyCommits?`, ${plan.ignoredLegacyCommits} historische Commits ausgenommen`:''}${plan.reuse?', Wiederholung':''})`);
        return;
    }
    const dir=parseOption(args,'--output');
    if(!dir) throw new Error('snapshot braucht --output DIR');
    fs.mkdirSync(dir,{recursive:true});
    if(!plan.reuse) {
        if(git('status','--porcelain')) throw new Error('Der Release-Snapshot erfordert einen sauberen Git-Checkout.');
        // Detach before the snapshot commit: a local checkout may still be on main.
        git('checkout','--detach',plan.head);
        applyAutomatedRelease(plan.version,plan.commits,plan.head,plan.previousTag);
        verifyReleaseMetadata();
        // Never commit to main: the only parent of the release snapshot is the approved main merge.
        git('add','--','package.json','package-lock.json','README.md','CHANGELOG.md',
            'docs/TESTSTATUS.md','docs/TESTHISTORIE.md','wcm-source-manifest.json');
        git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com',
            'commit','-m',`WCM Release Snapshot ${plan.tag}`);
        const snapshot=git('rev-parse','HEAD');
        if(commitParents(snapshot).join(' ')!==plan.head) throw new Error('Release-Snapshot hat einen falschen Parent.');
        git('tag',plan.tag,snapshot);
    } else {
        if(git('rev-parse',`${plan.tag}^{commit}`)!==plan.snapshot) throw new Error('Vorhandener Release-Tag ist ungueltig.');
    }
    const notes=plan.reuse
        ?git('show',`${plan.tag}:CHANGELOG.md`).split(/\n## /)[1]?.split(/\n## /)[0]||`${plan.tag} (Wiederholung)`
        :notesForPlan(plan);
    fs.writeFileSync(path.join(dir,'release-notes.md'),notes.endsWith('\n')?notes:notes+'\n');
    fs.writeFileSync(path.join(dir,'release-info.txt'),`tag=${plan.tag}\nversion=${plan.version}\n`);
    console.log(`Release-Snapshot ${plan.tag}: ${git('rev-parse',`${plan.tag}^{commit}`)}`);
}
const isCLI=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCLI) {try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
