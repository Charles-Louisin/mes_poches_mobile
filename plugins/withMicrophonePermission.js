const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const RECORD_AUDIO = 'android.permission.RECORD_AUDIO';
const MODIFY_AUDIO = 'android.permission.MODIFY_AUDIO_SETTINGS';

function ensurePermission(manifest, name) {
  const list = manifest.manifest['uses-permission'] || [];
  const exists = list.some((item) => item.$?.['android:name'] === name);
  if (!exists) {
    list.push({ $: { 'android:name': name } });
  } else {
    const item = list.find((entry) => entry.$?.['android:name'] === name);
    if (item?.$) {
      delete item.$['android:maxSdkVersion'];
      delete item.$['tools:node'];
    }
  }
  manifest.manifest['uses-permission'] = list;
}

function withMicrophonePermission(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [RECORD_AUDIO, MODIFY_AUDIO]);
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    ensurePermission(manifest, RECORD_AUDIO);
    ensurePermission(manifest, MODIFY_AUDIO);
    const features = manifest.manifest['uses-feature'] || [];
    if (!features.some((item) => item.$?.['android:name'] === 'android.hardware.microphone')) {
      features.push({
        $: {
          'android:name': 'android.hardware.microphone',
          'android:required': 'false',
        },
      });
    }
    manifest.manifest['uses-feature'] = features;
    return mod;
  });
}

module.exports = withMicrophonePermission;
