"""Trusted GitHub controller. Treat PR artifacts and comments as untrusted data."""

import io
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
import urllib.parse
import zipfile
from pathlib import Path

CONTEXT = 'Visual Approval'
MARKER = '<!-- wcm-visual-review:'
ID = re.compile(r'[a-z0-9-]+__\d+__(light|dark)\Z')
SHA = re.compile(r'[a-f0-9]{40}\Z')
DIGEST = re.compile(r'[a-f0-9]{64}\Z')
REPORT_ID = re.compile(r'\d+\.\d+\Z')
BOT = 'github-actions[bot]'
MAX_CHANGES = 300
MAX_DATA = 128 * 1024


def validate_report(data):
    """Validate the bounded data-only artifact before using any field."""
    if (type(data.get('pr')) is not int or data['pr'] < 1 or
            any(not SHA.fullmatch(str(data.get(k, '')))
                for k in ('base', 'head', 'merge')) or
            type(data.get('total')) is not int or not 1 <= data['total'] <= 1000):
        raise ValueError('Invalid report identity')
    changes = data.get('changes')
    if not isinstance(changes, list) or len(changes) > MAX_CHANGES:
        raise ValueError('Invalid change count')
    seen = set()
    for change in changes:
        name = change.get('id', '')
        if (not isinstance(name, str) or not ID.fullmatch(name) or len(name) > 100 or
                name in seen or change.get('kind') not in ('new', 'removed', 'changed') or
                not DIGEST.fullmatch(str(change.get('digest', '')))):
            raise ValueError('Invalid capture change')
        percent = change.get('percent')
        if percent is not None and (type(percent) not in (int, float) or
                                    not 0 <= percent <= 100):
            raise ValueError('Invalid pixel percentage')
        seen.add(name)
    return data


def read_artifact(raw):
    """Read one bounded JSON member; never extract or execute archive contents."""
    if len(raw) > MAX_DATA:
        raise ValueError('Oversized archive')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        members = archive.infolist()
        if (len(members) != 1 or members[0].filename != 'changes.json' or
                members[0].file_size > MAX_DATA):
            raise ValueError('Unexpected approval artifact')
        return validate_report(json.loads(archive.read(members[0])))


def report_key(run):
    return f"{run['id']}.{run['run_attempt']}"


def report_record(report, run):
    return {'run': report_key(run), 'changes': {
        change['id']: change['digest'] for change in report['changes']}}


def parse_record(comment):
    """Only the Actions bot can establish a report-to-fingerprint mapping."""
    if comment.get('user', {}).get('login') != BOT:
        return None
    body = comment.get('body') or ''
    match = re.search(re.escape(MARKER) + r'([^\n]+) -->', body)
    if not match:
        return None
    try:
        record = json.loads(match.group(1))
        changes = record['changes']
        if (not REPORT_ID.fullmatch(record['run']) or not isinstance(changes, dict) or
                len(changes) > MAX_CHANGES or any(
                    not ID.fullmatch(k) or not DIGEST.fullmatch(v)
                    for k, v in changes.items())):
            return None
        return record
    except (ValueError, KeyError, TypeError):
        return None


def approved_fingerprints(comments, permitted):
    """Replay exact report-scoped commands; carry forward unchanged fingerprints."""
    records = {}
    for comment in comments:
        record = parse_record(comment)
        if record:
            records[record['run']] = (record['changes'], comment['created_at'])
    approved = set()
    for comment in comments:
        words = (comment.get('body') or '').strip().split()
        if len(words) < 3 or words[0] != '/visual-approve' or words[1] not in records:
            continue
        changes, created = records[words[1]]
        if comment['created_at'] < created or not permitted(comment['user']['login']):
            continue
        selectors = words[2:]
        if selectors == ['all']:
            approved.update(changes.values())
            continue
        selected = set()
        for selector in selectors:
            matches = {v for k, v in changes.items()
                       if k == selector or k.split('__')[0] == selector}
            if not matches:
                break
            selected.update(matches)
        else:
            approved.update(selected)
    return approved


def report_body(report, run, approved, release=False):
    record = report_record(report, run)
    key = record['run']
    lines = ['## Visual Regression Report',
             f"Base `{report['base'][:12]}` · candidate `{report['merge'][:12]}`",
             f"{report['total']} candidate captures; {len(report['changes'])} differences.",
             f"[Download visual-review-{run['run_attempt']}]({run['html_url']}) "
             '(open Artifacts, extract ZIP, open `index.html`).', '']
    if release:
        lines += ['Verified immutable release-metadata PR: automatic visual approval.', '']
    lines += ['| Screenshot | Change | Pixels | Approval |', '|---|---|---:|---|']
    for change in report['changes']:
        percent = '-' if change['percent'] is None else f"{change['percent']:.3f}%"
        state = 'Approved' if release or change['digest'] in approved else 'Pending'
        lines.append(f"| `{change['id']}` | {change['kind']} | {percent} | {state} |")
    pending = [c for c in report['changes'] if c['digest'] not in approved]
    if pending and not release:
        lines += ['', 'After reviewing the images, comment with one or more exact IDs',
                  'or scenario names (all widths/themes of that scenario):', '',
                  f"`/visual-approve {key} {pending[0]['id']}`", '',
                  f"Approve every difference in this report: `/visual-approve {key} all`.",
                  'Approval requires repository write access. New differences require review.']
    else:
        lines += ['', '**Visual approval complete.**']
    lines += ['', MARKER + json.dumps(record, separators=(',', ':')) + ' -->']
    return '\n'.join(lines)


class GitHub:
    def __init__(self):
        self.repo = os.environ['GITHUB_REPOSITORY']
        self.token = os.environ['GH_TOKEN']
        self.root = os.environ.get('GITHUB_API_URL', 'https://api.github.com')
        self.permissions = {}

    def request(self, endpoint, method='GET', data=None, binary=False):
        url = self.root + '/repos/' + self.repo + '/' + endpoint
        headers = {'Authorization': 'Bearer ' + self.token,
                   'Accept': 'application/vnd.github+json',
                   'X-GitHub-Api-Version': '2022-11-28'}
        if binary:
            # API returns a signed external download URL. Do not forward the token.
            class NoRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, hdrs, newurl):
                    return None
            try:
                response = urllib.request.build_opener(NoRedirect()).open(
                    urllib.request.Request(url, headers=headers), timeout=30)
            except urllib.error.HTTPError as error:
                if error.code not in (302, 303, 307):
                    raise
                location = error.headers['Location']
                if not location.startswith('https://'):
                    raise ValueError('Unsafe artifact download URL')
                response = urllib.request.urlopen(location, timeout=30)
            with response:
                return response.read(MAX_DATA + 1)
        payload = None if data is None else json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
        with urllib.request.urlopen(urllib.request.Request(
                url, data=payload, headers=headers, method=method), timeout=30) as response:
            return json.load(response)

    def pages(self, endpoint, key=None):
        result = []
        join = '&' if '?' in endpoint else '?'
        for page in range(1, 101):
            batch = self.request(f'{endpoint}{join}per_page=100&page={page}')
            if key:
                batch = batch[key]
            result.extend(batch)
            if len(batch) < 100:
                return result
        raise ValueError('Pagination limit exceeded')

    def permitted(self, login):
        if login not in self.permissions:
            if not re.fullmatch(r'[A-Za-z0-9-]{1,39}', login):
                return False
            try:
                result = self.request(f'collaborators/{login}/permission')
                self.permissions[login] = result['permission'] in ('admin', 'maintain', 'write')
            except urllib.error.HTTPError as error:
                if error.code != 404:
                    raise
                self.permissions[login] = False
        return self.permissions[login]

    def artifact(self, run):
        if run['conclusion'] != 'success':
            return None
        name = f"visual-approval-data-{run['run_attempt']}"
        artifacts = self.pages(f"actions/runs/{run['id']}/artifacts", 'artifacts')
        matches = [a for a in artifacts if a['name'] == name and not a['expired']]
        if len(matches) != 1:
            return None
        return read_artifact(self.request(f"actions/artifacts/{matches[0]['id']}/zip", binary=True))

    def status(self, merge, state, run):
        self.request(f'statuses/{merge}', 'POST', {
            'state': state, 'context': CONTEXT, 'target_url': run['html_url'],
            'description': 'Visual changes approved' if state == 'success'
            else 'Review visual differences in the PR'})


def current(report, pr, run):
    """Do not approve a stale base, head, merge commit, or unrelated workflow run."""
    if (pr['state'] != 'open' or pr['base']['ref'] not in ('main', 'develop') or
            report['pr'] != pr['number'] or report['base'] != pr['base']['sha'] or
            report['head'] != pr['head']['sha'] or report['merge'] != pr['merge_commit_sha'] or
            run['event'] != 'pull_request' or run['head_sha'] not in (report['head'], report['merge'])):
        return False
    if not pr['head'].get('repo') or not run.get('head_repository'):
        return False
    if (run['head_repository']['id'] != pr['head']['repo']['id'] or
            run['head_branch'] != pr['head']['ref']):
        return False
    associated = run.get('pull_requests') or []
    return not associated or any(p['number'] == pr['number'] for p in associated)


def candidate_runs(api, pr):
    """List runs associated with the current head repository and branch."""
    runs = {}
    for sha in {pr['head']['sha'], pr.get('merge_commit_sha')} - {None}:
        for run in api.pages('actions/workflows/visual-regression.yml/runs?'
                             f'event=pull_request&head_sha={sha}', 'workflow_runs'):
            if (run.get('head_repository') and pr['head'].get('repo') and
                    run['head_repository']['id'] == pr['head']['repo']['id'] and
                    run['head_branch'] == pr['head']['ref'] and
                    (not run.get('pull_requests') or any(
                        p['number'] == pr['number'] for p in run['pull_requests']))):
                runs[run['id']] = run
    return sorted(runs.values(), key=lambda r: r['id'], reverse=True)


def latest_report(api, pr):
    """Find the latest run for this PR revision, including in-progress runs."""
    for run in candidate_runs(api, pr):
        # For a fork with no association metadata, conservatively wait if a newer
        # run of that same branch is still in progress or has failed.
        if run['status'] != 'completed' or run['conclusion'] != 'success':
            return None, None
        report = api.artifact(run)
        if report is None:
            return None, None
        if current(report, pr, run):
            return report, run
        if report['pr'] == pr['number']:
            return None, None
    return None, None


def verified_release(pr, repo):
    """Reuse the existing immutable-tag verifier, from trusted main only."""
    if (pr['base']['ref'] != 'main' or pr['head']['repo']['full_name'] != repo or
            not re.fullmatch(r'release/version-v\d+\.\d+\.\d+', pr['head']['ref'])):
        return False
    subprocess.run(['git', 'fetch', '--no-tags', 'origin',
                    f"refs/pull/{pr['number']}/head"], check=True)
    env = dict(os.environ, PR_SOURCE=pr['head']['ref'], PR_HEAD_SHA=pr['head']['sha'],
               PR_BASE_SHA=pr['base']['sha'], PR_AUTHOR=pr['user']['login'])
    # No checkout of the fetched commit and no execution of its code.
    return subprocess.run(['node', 'scripts/verify-version-pr.js'], env=env).returncode == 0


def mark_pending(api, source):
    """Invalidate an earlier successful status when a comparison is rerun."""
    run = api.request(f"actions/runs/{source['id']}")
    if (run['status'] == 'completed' or run['run_attempt'] != source['run_attempt']
            or not run.get('head_repository')):
        return
    associated = run.get('pull_requests') or []
    if associated:
        prs = [api.request(f"pulls/{p['number']}") for p in associated]
    else:
        head = run['head_repository']['owner']['login'] + ':' + run['head_branch']
        prs = api.pages('pulls?' + urllib.parse.urlencode({'state': 'open', 'head': head}))
    for pr in prs:
        if (pr['state'] != 'open' or pr['base']['ref'] not in ('main', 'develop') or
                not pr.get('merge_commit_sha') or not pr['head'].get('repo') or
                run['head_repository']['id'] != pr['head']['repo']['id'] or
                run['head_branch'] != pr['head']['ref'] or
                run['head_sha'] not in (pr['head']['sha'], pr['merge_commit_sha'])):
            continue
        latest = candidate_runs(api, pr)
        if latest and report_key(latest[0]) == report_key(run):
            live = api.request(f"actions/runs/{run['id']}")
            if live['status'] != 'completed' and report_key(live) == report_key(run):
                api.status(pr['merge_commit_sha'], 'pending', run)


def main():
    api = GitHub()
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    if 'workflow_run' in event:
        source = event['workflow_run']
        if event['action'] == 'in_progress':
            mark_pending(api, source)
            return
        report = api.artifact(source)
        if report is None:
            raise ValueError('Successful comparison has no approval artifact')
        number = report['pr']
    else:
        number = event['issue']['number']
    pr = api.request(f'pulls/{number}')
    if pr['state'] != 'open':
        return
    report, run = latest_report(api, pr)
    if report is None:
        print('No current successful visual comparison; no approval issued')
        return
    comments = api.pages(f'issues/{number}/comments')
    key = report_key(run)
    existing = next((c for c in comments if (parse_record(c) or {}).get('run') == key), None)
    release = verified_release(pr, api.repo)
    approved = approved_fingerprints(comments, api.permitted)
    body = report_body(report, run, approved, release)
    if existing:
        if existing['body'] != body:
            api.request(f"issues/comments/{existing['id']}", 'PATCH', {'body': body})
    else:
        api.request(f'issues/{number}/comments', 'POST', {'body': body})
    # Recheck both the revision and latest run after potentially slow API calls.
    fresh = api.request(f'pulls/{number}')
    latest, latest_run = latest_report(api, fresh)
    if latest is None or report_key(latest_run) != key or not current(report, fresh, run):
        print('PR changed during approval; ignoring stale report')
        return
    complete = release or all(c['digest'] in approved for c in report['changes'])
    api.status(report['merge'], 'success' if complete else 'pending', run)


if __name__ == '__main__':
    main()
