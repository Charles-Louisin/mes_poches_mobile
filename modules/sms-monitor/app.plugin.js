const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.RECEIVE_SMS',
  'android.permission.READ_SMS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECORD_AUDIO',
];

function withSmsMonitor(config) {
  config = AndroidConfig.Permissions.withPermissions(config, PERMISSIONS);
  return withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    app.$ = app.$ || {};
    if (!app.$['android:allowBackup']) {
      app.$['android:allowBackup'] = 'false';
    }
    return mod;
  });
}

module.exports = withSmsMonitor;
