"""Exercise installation and rollback in a temporary home; no Spotify is touched."""
import configparser
import importlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
installer = importlib.import_module('install')
restore = importlib.import_module('restore')


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ariotifi-test-')
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name) / 'user with spaces'
        self.home.mkdir()
        self.enterContext(patch.object(installer, 'HOME', self.home))
        self.enterContext(patch.object(restore, 'HOME', self.home))
        self.enterContext(patch.object(installer, 'preflight', return_value=[]))
        self.enterContext(patch.object(installer, 'cli_path', return_value='/mock/spicetify'))
        self.enterContext(patch.object(restore, 'cli_path', return_value='/mock/spicetify'))
        self.run = self.enterContext(patch.object(installer.subprocess, 'run'))
        self.run.return_value.returncode = 0
        self.config = self.home / installer.CONFIG_FILE

    def invoke(self, *args):
        with patch.object(sys, 'argv', ['install.py', *args]):
            return installer.main()

    def latest_backup(self):
        return next((self.home / '.local/state/ariotifi/backups').iterdir())

    def test_check_does_not_create_files(self):
        self.assertEqual(self.invoke('--check'), 0)
        self.assertEqual(list(self.home.iterdir()), [])
        self.run.assert_not_called()

    def test_fresh_install_and_restore(self):
        self.assertEqual(self.invoke(), 0)
        self.assertTrue((self.home / '.local/bin/spotify-personalizado').stat().st_mode & 0o100)
        self.assertTrue((self.home / installer.DESKTOP).is_file())
        self.assertIn('/mock/spicetify', self.run.call_args_list[0].args[0])
        self.assertEqual(self.run.call_args_list[0].args[0][1:], ('backup', 'apply', '-n'))
        with patch.object(sys, 'argv', ['restore.py', str(self.latest_backup())]):
            self.assertEqual(restore.main(), 0)
        for rel in installer.MANAGED:
            self.assertFalse((self.home / rel).exists(), rel)

    def test_update_preserves_backup_extensions_and_restores_bytes(self):
        self.config.parent.mkdir(parents=True)
        prior = ('[Setting]\ncurrent_theme = Previous\n[Backup]\nversion = 1.2.test\nwith = 2.45.3\n'
                 '[AdditionalOptions]\nextensions = other.js|flower-button.js|wavy-progress.js\n')
        self.config.write_text(prior)
        css = self.home / '.config/spicetify/Themes/VideoGlass/user.css'
        css.parent.mkdir(parents=True)
        css.write_text('original css')
        self.assertEqual(self.invoke('--spotify-path', str(self.home / 'custom client')), 0)
        config = configparser.ConfigParser()
        config.read(self.config)
        self.assertEqual(config['Backup']['version'], '1.2.test')
        self.assertEqual(config['AdditionalOptions']['extensions'], 'other.js|videoglass.js')
        launcher = (self.home / '.local/bin/spotify-personalizado').read_text()
        self.assertIn('custom client/spotify', launcher)
        self.assertEqual(self.run.call_args_list[0].args[0], ('/mock/spicetify', 'apply', '-n'))
        with patch.object(sys, 'argv', ['restore.py', str(self.latest_backup())]):
            self.assertEqual(restore.main(), 0)
        self.assertEqual(self.config.read_text(), prior)
        self.assertEqual(css.read_text(), 'original css')

    def test_refuses_incomplete_backup_before_running_commands(self):
        self.invoke()
        backup = self.latest_backup()
        manifest = json.loads((backup / 'manifest.json').read_text())
        manifest[installer.CONFIG_FILE] = True
        (backup / 'manifest.json').write_text(json.dumps(manifest))
        self.run.reset_mock()
        with patch.object(sys, 'argv', ['restore.py', str(backup)]), self.assertRaises(SystemExit):
            restore.main()
        self.run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
