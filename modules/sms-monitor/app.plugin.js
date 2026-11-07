const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');

const BASE_PERMISSIONS = [
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECORD_AUDIO',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
];

const CAPTURE_PERMISSIONS = [
  'android.permission.RECEIVE_SMS',
  'android.permission.READ_SMS',
];

function isCaptureBuild() {
  return (
    process.env.EXPO_PUBLIC_MONEY_CAPTURE === 'true' ||
    process.env.EAS_BUILD_PROFILE === 'production'
  );
}

const LISTENER = 'com.mespoches.app.MoneyNotificationListener';

const PROGUARD_BLOCK = [
  '',
  '# Mes Poches — NotificationListenerService (R8)',
  '-keep class com.mespoches.app.** { *; }',
  '-keep class * extends android.service.notification.NotificationListenerService { *; }',
  '-keepclassmembers class com.mespoches.app.MoneyNotificationListener { public <init>(); }',
  '-keepnames class com.mespoches.app.MoneyNotificationListener',
  '',
].join('\n');

function ensureToolsNs(manifest) {
  manifest.$ = manifest.$ || {};
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }
}

function ensurePermission(manifest, name) {
  const list = manifest['uses-permission'] || [];
  let item = list.find((entry) => entry.$?.['android:name'] === name);
  if (!item) {
    item = { $: { 'android:name': name } };
    list.push(item);
  }
  delete item.$['android:maxSdkVersion'];
  delete item.$['tools:node'];
  manifest['uses-permission'] = list;
}

function upsertNamed(list, name, entry) {
  const next = list || [];
  const index = next.findIndex((item) => item.$?.['android:name'] === name);
  if (index >= 0) next[index] = entry;
  else next.push(entry);
  return next;
}

function removeNamed(list, name) {
  const next = list || [];
  const stub = { $: { 'android:name': name, 'tools:node': 'remove' } };
  const index = next.findIndex((item) => item.$?.['android:name'] === name);
  if (index >= 0) next[index] = stub;
  else next.push(stub);
  return next;
}

function removePermission(manifest, name) {
  const list = manifest['uses-permission'] || [];
  const item = list.find((entry) => entry.$?.['android:name'] === name);
  if (item?.$) {
    item.$['tools:node'] = 'remove';
  } else {
    list.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
  }
  manifest['uses-permission'] = list;
}

function withListenerManifest(config) {
  const capture = isCaptureBuild();
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    ensureToolsNs(manifest);
    BASE_PERMISSIONS.forEach((name) => ensurePermission(manifest, name));
    if (capture) {
      CAPTURE_PERMISSIONS.forEach((name) => ensurePermission(manifest, name));
    } else {
      CAPTURE_PERMISSIONS.forEach((name) => removePermission(manifest, name));
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    app.$ = app.$ || {};
    app.$['android:allowBackup'] = 'false';

    if (capture) {
      app.receiver = upsertNamed(app.receiver, 'com.mespoches.app.SmsReceiver', {
        $: {
          'android:name': 'com.mespoches.app.SmsReceiver',
          'android:exported': 'true',
          'android:permission': 'android.permission.BROADCAST_SMS',
          'tools:node': 'replace',
        },
        'intent-filter': [
          {
            $: { 'android:priority': '999' },
            action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
          },
        ],
      });
    } else {
      app.receiver = removeNamed(app.receiver, 'com.mespoches.app.SmsReceiver');
    }

    app.receiver = upsertNamed(app.receiver, 'com.mespoches.app.DailyReminderReceiver', {
      $: {
        'android:name': 'com.mespoches.app.DailyReminderReceiver',
        'android:exported': 'false',
        'tools:node': 'replace',
      },
    });

    app.receiver = upsertNamed(app.receiver, 'com.mespoches.app.FeedbackInboxReceiver', {
      $: {
        'android:name': 'com.mespoches.app.FeedbackInboxReceiver',
        'android:exported': 'false',
        'tools:node': 'replace',
      },
    });

    app.receiver = upsertNamed(app.receiver, 'com.mespoches.app.BootReceiver', {
      $: {
        'android:name': 'com.mespoches.app.BootReceiver',
        'android:exported': 'true',
        'android:enabled': 'true',
        'tools:node': 'replace',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
          ],
        },
      ],
    });

    if (capture) {
      app.service = upsertNamed(app.service, LISTENER, {
        $: {
          'android:name': LISTENER,
          'android:exported': 'false',
          'android:enabled': 'true',
          'android:label': 'MES POCHES',
          'android:process': ':notif',
          'android:stopWithTask': 'false',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'tools:node': 'replace',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.service.notification.NotificationListenerService' },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.service.notification.default_filter_types',
              'android:value': 'conversations|alerting|silent',
            },
          },
          {
            $: {
              'android:name': 'android.service.notification.disabled_filter_types',
              'android:value': 'ongoing',
            },
          },
        ],
      });
    } else {
      app.service = removeNamed(app.service, LISTENER);
    }

    return mod;
  });
}

const JAVA_HELPER = `
  private boolean isMesPochesNotifProcess() {
    try {
      String name;
      if (android.os.Build.VERSION.SDK_INT >= 28) {
        name = android.app.Application.getProcessName();
      } else {
        name = null;
        int pid = android.os.Process.myPid();
        android.app.ActivityManager am =
            (android.app.ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am != null && am.getRunningAppProcesses() != null) {
          for (android.app.ActivityManager.RunningAppProcessInfo info : am.getRunningAppProcesses()) {
            if (info.pid == pid) {
              name = info.processName;
              break;
            }
          }
        }
      }
      return name != null && name.endsWith(":notif");
    } catch (Throwable ignored) {
      return false;
    }
  }
`;

const KT_HELPER = `
  private fun isMesPochesNotifProcess(): Boolean {
    return try {
      val name = if (android.os.Build.VERSION.SDK_INT >= 28) {
        android.app.Application.getProcessName()
      } else {
        val pid = android.os.Process.myPid()
        val am = getSystemService(ACTIVITY_SERVICE) as? android.app.ActivityManager
        am?.runningAppProcesses?.firstOrNull { it.pid == pid }?.processName
      }
      name != null && name.endsWith(":notif")
    } catch (_: Throwable) {
      false
    }
  }
`;

function withNotifProcessApplication(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.contents.includes('isMesPochesNotifProcess')) {
      return mod;
    }
    const isJava = mod.modResults.language === 'java';
    let src = mod.modResults.contents;
    if (isJava) {
      src = src.replace(
        /void\s+onCreate\s*\(\s*\)\s*\{/,
        `void onCreate() {\n    if (isMesPochesNotifProcess()) {\n      super.onCreate();\n      return;\n    }`
      );
      src = AndroidConfig.CodeMod.appendContentsInsideDeclarationBlock(
        src,
        'class MainApplication',
        JAVA_HELPER
      );
    } else {
      src = src.replace(
        /override\s+fun\s+onCreate\s*\(\s*\)\s*\{/,
        `override fun onCreate() {\n    if (isMesPochesNotifProcess()) {\n      super.onCreate()\n      return\n    }`
      );
      src = AndroidConfig.CodeMod.appendContentsInsideDeclarationBlock(
        src,
        'class MainApplication',
        KT_HELPER
      );
    }
    mod.modResults.contents = src;
    return mod;
  });
}

function withAppProguard(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const file = path.join(mod.modRequest.platformProjectRoot, 'app/proguard-rules.pro');
      try {
        const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        if (!current.includes('MoneyNotificationListener')) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, `${current.trimEnd()}\n${PROGUARD_BLOCK}`);
        }
      } catch {
        /* prebuild peut n'avoir pas encore créé le fichier */
      }
      return mod;
    },
  ]);
}

function withSmsMonitor(config) {
  const capture = isCaptureBuild();
  config = AndroidConfig.Permissions.withPermissions(
    config,
    capture ? [...BASE_PERMISSIONS, ...CAPTURE_PERMISSIONS] : BASE_PERMISSIONS
  );
  config = withListenerManifest(config);
  if (capture) {
    config = withNotifProcessApplication(config);
    config = withAppProguard(config);
  }
  return config;
}

module.exports = withSmsMonitor;
