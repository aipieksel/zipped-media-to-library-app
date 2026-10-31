import assert from 'node:assert/strict';
import test from 'node:test';
import {settingsSectionFromHash} from '../src/settings-route';

test('Settings deep links keep sections distinct from file workspaces and auth capabilities', () => {
  for (const section of ['profile', 'ai', 'appearance', 'workspace', 'accounts']) {
    assert.equal(settingsSectionFromHash('#settings/' + section), section);
  }
  assert.equal(settingsSectionFromHash('#settings'), 'profile');
  for (const hash of ['#icons', '#images', '#html', '#png-to-svg', '#register?token=fixture', '#recover?token=fixture', '#settings/unknown', '#settings/ai?token=x', '#settings/../../profile']) {
    assert.equal(settingsSectionFromHash(hash), null);
  }
});
