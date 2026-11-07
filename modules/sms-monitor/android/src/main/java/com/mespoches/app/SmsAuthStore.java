package com.mespoches.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.util.Log;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * JWT + URL API pour SmsReceiver / MoneyNotificationListener.
 * Les lecteurs d'arrière-plan (surtout le process :notif) n'ouvrent jamais
 * EncryptedSharedPreferences : le Keystore y provoque des crashes natifs.
 */
public final class SmsAuthStore {
    private static final String TAG = "MesPochesSms";
    public static final String PREFS = "mespoches_sms";
    public static final String SECURE_PREFS = "mespoches_sms_secure";
    public static final String KEY_TOKEN = "auth_token";
    public static final String KEY_API = "api_base_url";
    public static final String KEY_INBOX_LAST_AT = "inbox_last_at";
    public static final String KEY_INBOX_HEARTBEAT = "inbox_heartbeat";
    private static final String TOKEN_FILE = "mespoches_sms_auth.txt";
    private static final String CONNECTED_FILE = "mespoches_nl_connected.txt";
    private static final long JS_INBOX_TTL_MS = 90_000L;

    private static final String DEFAULT_API =
        "https://mespochesbackend-production-dafd.up.railway.app/api";

    private static final Set<String> ALLOWED_HOST_SUFFIXES = new HashSet<>(Arrays.asList(
        ".up.railway.app",
        ".ngrok-free.app",
        ".ngrok-free.dev",
        ".ngrok.io"
    ));

    private static final Set<String> ALLOWED_EXACT_HOSTS = new HashSet<>(Arrays.asList(
        "localhost",
        "127.0.0.1",
        "10.0.2.2",
        "mespochesbackend-production.up.railway.app",
        "mespochesbackend-production-dafd.up.railway.app"
    ));

    private static volatile SharedPreferences cachedPrefs;

    private SmsAuthStore() {}

    /**
     * Préférences chiffrées (clé dans le Keystore Android). Uniquement depuis
     * le process UI. Repli MODE_PRIVATE si le Keystore est indisponible.
     */
    private static synchronized SharedPreferences prefs(Context context) {
        if (cachedPrefs != null) return cachedPrefs;
        Context app = context.getApplicationContext();
        try {
            MasterKey key = new MasterKey.Builder(app)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();
            cachedPrefs = EncryptedSharedPreferences.create(
                app,
                SECURE_PREFS,
                key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
            migrateLegacyPrefs(app, cachedPrefs);
        } catch (Throwable e) {
            Log.w(TAG, "EncryptedSharedPreferences indisponible, repli MODE_PRIVATE");
            cachedPrefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        }
        return cachedPrefs;
    }

    /** Reprend le token des anciennes installations. Le fichier clair reste un miroir. */
    private static void migrateLegacyPrefs(Context app, SharedPreferences target) {
        SharedPreferences legacy = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String legacyToken = legacy.getString(KEY_TOKEN, "");
        if (legacyToken.isEmpty()) return;
        if (target.getString(KEY_TOKEN, "").isEmpty()) {
            target
                .edit()
                .putString(KEY_TOKEN, legacyToken)
                .putString(KEY_API, legacy.getString(KEY_API, ""))
                .apply();
        }
    }

    /** Préférences non chiffrées, lisibles depuis le listener même si le Keystore échoue. */
    private static SharedPreferences plainPrefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static File filesDir(Context context) {
        return context.getApplicationContext().getFilesDir();
    }

    /** Fichier process-safe : SharedPreferences n'est pas fiable entre :notif et le process UI. */
    private static File tokenFile(Context context) {
        return new File(filesDir(context), TOKEN_FILE);
    }

    private static File connectedFile(Context context) {
        return new File(filesDir(context), CONNECTED_FILE);
    }

    private static void writeTokenFile(Context context, String token, String api) {
        try {
            File dest = tokenFile(context);
            File tmp = new File(dest.getAbsolutePath() + ".tmp");
            String body = "v1\n" + (token == null ? "" : token) + "\n" + (api == null ? "" : api) + "\n";
            try (FileOutputStream fos = new FileOutputStream(tmp)) {
                fos.write(body.getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }
            if (!tmp.renameTo(dest) && dest.exists()) {
                // no-op : le tmp reste un fallback à la prochaine lecture
            }
        } catch (Exception e) {
            Log.w(TAG, "token file write failed", e);
        }
    }

    private static String[] readTokenFile(Context context) {
        File dest = tokenFile(context);
        File tmp = new File(dest.getAbsolutePath() + ".tmp");
        File src = dest.exists() ? dest : (tmp.exists() ? tmp : null);
        if (src == null) return null;
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(new FileInputStream(src), StandardCharsets.UTF_8))) {
            String version = reader.readLine();
            if (version == null) return null;
            String token = reader.readLine();
            String api = reader.readLine();
            return new String[] { token == null ? "" : token, api == null ? "" : api };
        } catch (Exception e) {
            return null;
        }
    }

    private static void clearTokenFile(Context context) {
        try {
            File dest = tokenFile(context);
            File tmp = new File(dest.getAbsolutePath() + ".tmp");
            if (dest.exists() && !dest.delete()) {
                Log.w(TAG, "token file delete failed");
            }
            if (tmp.exists() && !tmp.delete()) {
                Log.w(TAG, "token tmp delete failed");
            }
        } catch (Exception ignored) {
            /* ignore */
        }
    }

    public static void store(Context context, String token, String apiUrl) {
        String api = sanitizeApiUrl(apiUrl);
        writeTokenFile(context, token, api);
        plainPrefs(context).edit().putString(KEY_TOKEN, token).putString(KEY_API, api).commit();
        try {
            prefs(context).edit().putString(KEY_TOKEN, token).putString(KEY_API, api).apply();
        } catch (Throwable e) {
            Log.w(TAG, "secure store skipped", e);
        }
        requestListenerRebind(context);
    }

    public static void clear(Context context) {
        clearTokenFile(context);
        plainPrefs(context).edit()
            .remove(KEY_TOKEN)
            .remove(KEY_API)
            .remove(KEY_INBOX_LAST_AT)
            .remove(KEY_INBOX_HEARTBEAT)
            .commit();
        try {
            prefs(context).edit()
                .remove(KEY_TOKEN)
                .remove(KEY_API)
                .remove(KEY_INBOX_LAST_AT)
                .remove(KEY_INBOX_HEARTBEAT)
                .apply();
        } catch (Throwable e) {
            Log.w(TAG, "secure clear skipped", e);
        }
    }

    public static String getInboxLastAt(Context context) {
        String value = plainPrefs(context).getString(KEY_INBOX_LAST_AT, "");
        if (value != null && !value.isEmpty()) return value;
        try {
            return prefs(context).getString(KEY_INBOX_LAST_AT, "");
        } catch (Throwable e) {
            return "";
        }
    }

    public static void setInboxLastAt(Context context, String lastAt) {
        String value = lastAt == null ? "" : lastAt;
        plainPrefs(context).edit().putString(KEY_INBOX_LAST_AT, value).commit();
        try {
            prefs(context).edit().putString(KEY_INBOX_LAST_AT, value).apply();
        } catch (Throwable ignored) {
            /* ignore */
        }
    }

    public static void touchInboxHeartbeat(Context context) {
        String now = String.valueOf(System.currentTimeMillis());
        plainPrefs(context).edit().putString(KEY_INBOX_HEARTBEAT, now).apply();
        try {
            prefs(context).edit().putString(KEY_INBOX_HEARTBEAT, now).apply();
        } catch (Throwable ignored) {
            /* ignore */
        }
    }

    public static boolean isJsInboxActive(Context context) {
        String raw = plainPrefs(context).getString(KEY_INBOX_HEARTBEAT, "");
        if (raw == null || raw.isEmpty()) {
            try {
                raw = prefs(context).getString(KEY_INBOX_HEARTBEAT, "");
            } catch (Throwable e) {
                raw = "";
            }
        }
        if (raw == null || raw.isEmpty()) return false;
        try {
            return System.currentTimeMillis() - Long.parseLong(raw) < JS_INBOX_TTL_MS;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /** Lecture process-safe : fichier, puis prefs claires. Jamais le Keystore. */
    public static String getStoredToken(Context context) {
        String[] file = readTokenFile(context);
        if (file != null && file[0] != null && !file[0].isEmpty()) return file[0];
        String token = plainPrefs(context).getString(KEY_TOKEN, "");
        return token == null ? "" : token;
    }

    public static String getApiBase(Context context) {
        String[] file = readTokenFile(context);
        String api = file != null ? file[1] : "";
        if (api == null || api.isEmpty()) {
            api = plainPrefs(context).getString(KEY_API, "");
        }
        return sanitizeApiUrl(api);
    }

    public static boolean isNotificationListenerEnabled(Context context) {
        String pkg = context.getPackageName();
        String expectedClass = MoneyNotificationListener.class.getName();
        String flat = Settings.Secure.getString(
            context.getContentResolver(),
            "enabled_notification_listeners"
        );
        if (flat == null || flat.isEmpty()) return false;
        String[] names = flat.split(":");
        for (String name : names) {
            if (name == null || name.isEmpty()) continue;
            ComponentName cn = ComponentName.unflattenFromString(name);
            if (cn != null && pkg.equals(cn.getPackageName())) {
                String cls = cn.getClassName();
                if (cls == null || cls.isEmpty() || expectedClass.equals(cls) || cls.endsWith(".MoneyNotificationListener")) {
                    return true;
                }
            }
        }
        return false;
    }

    public static boolean isListenerConnected(Context context) {
        File file = connectedFile(context);
        if (!file.exists()) return false;
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line = reader.readLine();
            return line != null && line.trim().equals("1");
        } catch (Exception e) {
            return false;
        }
    }

    public static void setListenerConnected(Context context, boolean connected) {
        try {
            File dest = connectedFile(context);
            try (FileOutputStream fos = new FileOutputStream(dest)) {
                fos.write((connected ? "1\n" : "0\n").getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }
        } catch (Exception e) {
            Log.w(TAG, "connected flag write failed", e);
        }
    }

    public static void requestListenerRebind(Context context) {
        try {
            if (!isNotificationListenerEnabled(context)) return;
            ComponentName cn = new ComponentName(context, MoneyNotificationListener.class);
            NotificationListenerService.requestRebind(cn);
        } catch (Throwable t) {
            Log.w(TAG, "requestRebind failed", t);
        }
    }

    static String sanitizeApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.trim().isEmpty()) {
            return DEFAULT_API;
        }
        try {
            URI uri = URI.create(apiUrl.trim());
            String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
            String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
            if (!scheme.equals("https") && !(scheme.equals("http") && isLocalHost(host))) {
                Log.w(TAG, "Rejected apiUrl scheme");
                return DEFAULT_API;
            }
            if (!isAllowedHost(host)) {
                Log.w(TAG, "Rejected apiUrl host");
                return DEFAULT_API;
            }
            return apiUrl.trim().replaceAll("/+$", "");
        } catch (Exception e) {
            return DEFAULT_API;
        }
    }

    private static boolean isLocalHost(String host) {
        return host.equals("localhost") || host.equals("127.0.0.1") || host.equals("10.0.2.2");
    }

    private static boolean isAllowedHost(String host) {
        if (host == null || host.isEmpty()) return false;
        if (ALLOWED_EXACT_HOSTS.contains(host)) return true;
        for (String suffix : ALLOWED_HOST_SUFFIXES) {
            if (host.endsWith(suffix)) return true;
        }
        return false;
    }
}
