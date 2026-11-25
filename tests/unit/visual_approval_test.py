"""Exercise the data-only approval protocol without GitHub credentials."""
import importlib.util
import io
import json
import unittest
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


if __name__ == '__main__':
    unittest.main()
