/**
 * Declarative deployment contracts, not tests of application source spelling.
 * GitHub Actions and Docker image publishing run in their actual CI environments;
 * this checker prevents unsafe release-config changes before those workflows run.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=(value,message)=>{if(!value)throw new Error(`Deployment contract: ${message}`);};
const requireText=(text,snippet,message)=>check(text.includes(snippet),message);
const noText=(text,snippet,message)=>check(!text.includes(snippet),message);

export function verifyDeploymentConfiguration(read=name=>fs.readFileSync(path.join(ROOT,name),'utf8')) {
    const compose=read('docker-compose.yml');
    const docker=read('docker/app.Dockerfile');
    const checkWorkflow=read('.github/workflows/check.yml');
    const release=read('.github/workflows/release.yml');
    const ignored=read('.dockerignore')+'\n'+read('.gitignore');
    const pkg=JSON.parse(read('package.json'));
    const lock=JSON.parse(read('package-lock.json'));

    // These are contracts on externally consumed configuration (not assertions
    // that a particular JavaScript module uses a particular method or variable).
    requireText(compose,'services:\n  app:', 'one combined application service must exist');
    check(!/^  (?:backup-worker|api|web):/m.test(compose),'do not split the app into separate uncoordinated services');
    requireText(compose,"'3543:3543'",'HTTPS must be published on port 3543');
    noText(compose,"'3100:3100'",'plaintext port must not be published');
    requireText(compose,"HTTP_ENABLED: 'false'",'plaintext HTTP must be disabled');
    requireText(compose,"HTTPS_ENABLED: 'true'",'HTTPS must be enabled');
    requireText(compose,'APP_INTERNAL_URL: https://127.0.0.1:3543','backup worker must use HTTPS loopback');
    requireText(compose,'read_only: true','container root filesystem must remain read-only');
    for(const destination of ['/srv/whisky','/backup-control','/backup-targets','/config/rclone'])
        check(compose.includes(`:${destination}`),`durable volume missing: ${destination}`);
    for(const secret of ['backup-admin-token','backup-worker-token','restic-password'])
        check(compose.includes(`/run/secrets/${secret}:ro`),`read-only secret missing: ${secret}`);
    for(const ignoredPath of ['certs','data','images','documents','backups','deploy/secrets','deploy/backup-control','deploy/rclone'])
        check(ignored.includes(ignoredPath),`local private data must be ignored: ${ignoredPath}`);

    requireText(docker,'FROM node:22-bookworm-slim','production image must use the supported Debian Node runtime');
    requireText(docker,'npm ci --omit=dev','production dependencies must be locked');
    requireText(docker,'restic rclone openssh-client','backup tools must be installed in the same container');
    requireText(docker,'node scripts/prepare-cutout-assets.js','AI assets must be prepared as part of the image build');
    requireText(docker,'EXPOSE 3543','production image must expose HTTPS');
    noText(docker,'EXPOSE 3100','production image must not expose the old HTTP port');
    check(!/COPY\s+\.\s+\./.test(docker),'do not copy private working-tree files into the image');

    // Free private repositories cannot rely on GitHub rulesets to prevent
    // bypasses. A release must verify the merged PR with the GitHub API.
    requireText(checkWorkflow,'  test:','required GitHub status job must exist');
    for(const command of ['npm run check','npm test','npm run test:browser','release-automation.js plan --json', 'release-automation.js validate --range'])
        requireText(checkWorkflow,command,`PR CI must execute ${command}`);
    requireText(checkWorkflow,'test "$PR_SOURCE" = develop','only develop may merge to main');
    requireText(release,'Verify the merged develop pull request',
        'release must independently verify approved develop-to-main PR');
    requireText(release,'/commits/${MERGE_SHA}/pulls',
        'release must query the PR associated with its exact merge commit');
    requireText(release,'node scripts/verify-merged-pr.js',
        'release must check exact PR origin and merge SHA with the API payload');
    requireText(release,'pull-requests: read',
        'release must request permission to query private merged PRs');
    requireText(release,'release-automation.js snapshot --output',
        'release must create versioned tagged snapshots automatically');
    requireText(release,'branches: [main]', 'release must be triggered by main');
    requireText(release,'git checkout --detach "$tag"', 'package must use tagged snapshot');
    noText(release,'git push origin main', 'release workflow must never push to protected main');
    requireText(checkWorkflow,'"$PR_SOURCE_REPO" = "$GITHUB_REPOSITORY"','PR source must be same repository');

    for(const command of ['npm run test:browser','git archive','verify-release-files.js',
        'node scripts/offline-bundle.js seal','npm_config_offline=true','--network none',
        'docker image save --platform "$platform"','docker load',
        'docker/build-push-action@v7','platforms: linux/arm64,linux/amd64',
        'file: docker/app.Dockerfile','needs: [prepare, package, docker, docker-offline]',
        'gh release create','gh release upload','gh release edit','--draft', '--draft=false',
        'docker buildx imagetools create','docker pull --platform', 'docker run --rm --platform',
        '--entrypoint node', '--check /app/docker/entrypoint.js', 'restic version', 'rclone version', 'ssh -V'])
        requireText(release,command,`release pipeline must include ${command}`);
    noText(release,'docker/backup-worker.Dockerfile','only the unified image is published');
    check(!/branches: \[main, master\]/.test(release),'release must not accept an unprotected master branch');
    check(!fs.existsSync(path.join(ROOT,'.github/workflows/docker-publish.yml')),
        'obsolete parallel Docker publisher must not exist');
    const uploads=[...release.matchAll(/^\s*run: gh release upload (.*)$/gm)].map(hit=>hit[1]);
    check(uploads.length===2,'both release assets must be explicitly uploaded');
    check(uploads.every(command=>command.includes('--repo "$GITHUB_REPOSITORY"')),
        'release asset uploads must specify the repository');
    requireText(read('.dockerignore'),'.offline','offline cache must not enter regular Docker builds');
    requireText(read('.gitignore'),'.offline/','offline cache must not enter source commits');

    const pinned=pkg.devDependencies?.['playwright-core'];
    check(/^\d+\.\d+\.\d+$/.test(pinned||''),'Playwright must have a pinned version');
    check(lock.packages?.['']?.devDependencies?.['playwright-core']===pinned,
        'lockfile must match the pinned Playwright dependency');
    check(lock.packages?.['node_modules/playwright-core']?.version===pinned,
        'lockfile must contain that exact Playwright version');
    return {service:'app',statusJob:'test',browserCheck:true,offlineCheck:true};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    verifyDeploymentConfiguration();
    console.log('Deployment contracts: Docker, HTTPS, backup, offline release and GitHub CI OK.');
}
