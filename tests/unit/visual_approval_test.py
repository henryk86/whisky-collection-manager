"""Exercise the data-only approval protocol without GitHub credentials."""
import importlib.util
import io
import json
import unittest
import urllib.error
from unittest.mock import Mock, patch
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    'visual_approval', Path(__file__).resolve().parents[2] / 'scripts/visual-approval.py')
controller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controller)

FIRST = 'modal-edit__390__dark'
SECOND = 'modal-edit__768__light'
THIRD = 'help__390__dark'
DIGESTS = {FIRST: 'a' * 64, SECOND: 'b' * 64, THIRD: 'c' * 64}


def comment(login, body, date='2026-11-25T12:00:01Z'):
    return {'user': {'login': login}, 'body': body, 'created_at': date}


def bot(run, changes):
    return comment(controller.BOT, controller.MARKER + json.dumps(
        {'run': run, 'changes': changes}) + ' -->', '2026-11-25T12:00:00Z')


def permitted(login):
    return login == 'maintainer'


class ApprovalTest(unittest.TestCase):
    def test_individual_group_and_all(self):
        records = [bot('1.1', DIGESTS)]
        for command, expected in [(FIRST, {'a' * 64}),
                                  ('modal-edit', {'a' * 64, 'b' * 64}),
                                  ('all', set(DIGESTS.values())),
                                  ('modal-edit missing', set())]:
            comments = records + [comment('maintainer', '/visual-approve 1.1 ' + command)]
            self.assertEqual(controller.approved_fingerprints(comments, permitted), expected)

    def test_reuse_exact_fingerprints_only(self):
        records = [bot('1.1', DIGESTS), bot('2.1', {FIRST: 'a' * 64, SECOND: 'd' * 64})]
        records.append(comment('maintainer', '/visual-approve 1.1 all'))
        approved = controller.approved_fingerprints(records, permitted)
        self.assertIn('a' * 64, approved)
        self.assertNotIn('d' * 64, approved)

    def test_unauthorized_spoofed_unknown_or_preemptive_approval(self):
        records = [bot('1.1', DIGESTS),
                   comment('stranger', '/visual-approve 1.1 all'),
                   comment('maintainer', '/visual-approve 2.1 all'),
                   comment('maintainer', '/visual-approve 1.1 all', '2026-11-25T11:59:59Z'),
                   comment('maintainer', bot('3.1', DIGESTS)['body']),
                   comment('maintainer', '/visual-approve 3.1 all')]
        self.assertEqual(controller.approved_fingerprints(records, permitted), set())

    def test_archive_and_revision_validation(self):
        data = {'pr': 7, 'base': '1' * 40, 'head': '2' * 40, 'merge': '3' * 40,
                'total': 1, 'changes': [{'id': FIRST, 'kind': 'changed',
                                         'digest': 'a' * 64, 'percent': 1}]}
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, 'w') as archive:
            archive.writestr('changes.json', json.dumps(data))
        self.assertEqual(controller.read_artifact(raw.getvalue()), data)
        pr = {'state': 'open', 'number': 7, 'base': {'ref': 'develop', 'sha': data['base']},
              'head': {'sha': data['head'], 'ref': 'feature', 'repo': {'id': 1}},
              'merge_commit_sha': data['merge']}
        run = {'event': 'pull_request', 'head_sha': data['head'], 'head_branch': 'feature',
               'head_repository': {'id': 1}, 'pull_requests': [{'number': 7}]}
        self.assertTrue(controller.current(data, pr, run))
        pr['base']['sha'] = '4' * 40
        self.assertFalse(controller.current(data, pr, run))
        data['changes'][0]['id'] = '../../malicious'
        with self.assertRaises(ValueError):
            controller.validate_report(data)
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, 'w') as archive:
            archive.writestr('../changes.json', '{}')
        with self.assertRaises(ValueError):
            controller.read_artifact(raw.getvalue())


class ControllerStatusTest(unittest.TestCase):
    def test_workflow_review_requires_successful_completion(self):
        for action, status, conclusion in [('in_progress', 'in_progress', None),
                                           ('completed', 'completed', 'failure'),
                                           ('completed', 'completed', 'cancelled')]:
            with self.subTest(action=action, conclusion=conclusion):
                api = Mock()
                event = {'action': action, 'workflow_run': {'event': 'pull_request',
                         'status': status, 'conclusion': conclusion}}
                with patch.object(controller, 'GitHub', return_value=api),                         patch.object(controller.Path, 'read_text', return_value=json.dumps(event)),                         patch.dict(controller.os.environ, {'GITHUB_EVENT_PATH': 'event.json'}):
                    controller.main()
                api.artifact.assert_not_called()
                api.status.assert_not_called()

    def test_latest_comparison_blocks_comment_approval(self):
        api = Mock()
        for status, conclusion in [('queued', None), ('in_progress', None),
                                   ('completed', 'failure'), ('completed', 'cancelled')]:
            with self.subTest(status=status, conclusion=conclusion):
                with patch.object(controller, 'candidate_runs', return_value=[
                        {'status': status, 'conclusion': conclusion}]):
                    self.assertEqual(controller.latest_report(api, {}), (None, None))
        api.artifact.assert_not_called()

    def test_failed_latest_comparison_invalidates_previous_approval(self):
        api = Mock()
        run = {'id': 1, 'run_attempt': 2, 'status': 'completed', 'conclusion': 'failure',
               'head_repository': {'id': 1}, 'head_branch': 'feature', 'head_sha': 'a' * 40,
               'pull_requests': [{'number': 7}]}
        pr = {'state': 'open', 'base': {'ref': 'main'}, 'merge_commit_sha': 'b' * 40,
              'head': {'repo': {'id': 1}, 'ref': 'feature', 'sha': 'a' * 40}}
        api.request.side_effect = [run, pr, run]
        with patch.object(controller, 'candidate_runs', return_value=[run]):
            controller.mark_pending(api, run)
        api.status.assert_called_once_with(pr['merge_commit_sha'], 'pending', run)

    def test_comment_failure_preserves_correct_status(self):
        for changes, expected in [([], 'success'),
                                  ([{'id': FIRST, 'kind': 'changed',
                                     'digest': 'a' * 64, 'percent': 1}], 'pending')]:
            for existing in (False, True):
                with self.subTest(expected=expected, existing=existing):
                    report = {'pr': 7, 'base': '1' * 40, 'head': '2' * 40,
                              'merge': '3' * 40, 'total': 1, 'changes': changes}
                    run = {'id': 1, 'run_attempt': 1, 'html_url': 'https://github.com/run/1'}
                    api = Mock()
                    api.pages.return_value = ([dict(bot('1.1', {}), id=9)]
                                              if existing else [])
                    pr = {'state': 'open'}

                    def request(endpoint, method='GET', data=None):
                        if method == 'GET':
                            return pr
                        self.assertEqual(method, 'PATCH' if existing else 'POST')
                        api.status.assert_called_once_with(report['merge'], expected, run)
                        raise urllib.error.HTTPError(endpoint, 403, 'Forbidden', {}, None)

                    api.request.side_effect = request
                    with patch.object(controller, 'GitHub', return_value=api), \
                            patch.object(controller.Path, 'read_text', return_value='{"issue":{"number":7}}'), \
                            patch.dict(controller.os.environ, {'GITHUB_EVENT_PATH': 'event.json'}), \
                            patch.object(controller, 'latest_report', return_value=(report, run)), \
                            patch.object(controller, 'current', return_value=True), \
                            patch.object(controller, 'verified_release', return_value=False):
                        with self.assertRaises(urllib.error.HTTPError):
                            controller.main()
                    api.status.assert_called_once_with(report['merge'], expected, run)


if __name__ == '__main__':
    unittest.main()
