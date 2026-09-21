package com.mespoches.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Log;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Stockage du JWT lu par SmsReceiver / MoneyNotificationListener. */
public final class SmsAuthStore {
    private static final String TAG = "MesPochesSms";
    public static final String PREFS = "mespoches_sms";
    public static final String SECURE_PREFS = "mespoches_sms_secure";
    public static final String KEY_TOKEN = "auth_token";
    public static final String KEY_API = "api_base_url";

    private static final String DEFAULT_API =
        "https://mespochesbackend-production-9bfe.up.railway.app/api";

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
        "mespochesbackend-production-9bfe.up.railway.app"
    ));

    private static volatile SharedPreferences cachedPrefs;

    private SmsAuthStore() {}

    /**
     * Préférences chiffrées (clé dans le Keystore Android) : le JWT n'est plus
     * lisible en clair sur un appareil rooté. Repli sur MODE_PRIVATE si le
     * Keystore est indisponible, sinon le module SMS cesserait de fonctionner.
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
        } catch (Exception e) {
            Log.w(TAG, "EncryptedSharedPreferences indisponible, repli MODE_PRIVATE");
            cachedPrefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        }
        return cachedPrefs;
    }

    /** Reprend le token des anciennes installations puis efface la version en clair. */
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
        // Ne toucher qu'aux clés d'auth : OfflinePendingQueue partage ce fichier.
        legacy.edit().remove(KEY_TOKEN).remove(KEY_API).apply();
    }

    public static void store(Context context, String token, String apiUrl) {
        prefs(context)
            .edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_API, sanitizeApiUrl(apiUrl))
            .apply();
    }

    public static void clear(Context context) {
        prefs(context).edit().remove(KEY_TOKEN).remove(KEY_API).apply();
    }

    public static String getStoredToken(Context context) {
        return prefs(context).getString(KEY_TOKEN, "");
    }

    public static String getApiBase(Context context) {
        return sanitizeApiUrl(prefs(context).getString(KEY_API, ""));
    }

    public static boolean isNotificationListenerEnabled(Context context) {
        String pkg = context.getPackageName();
        String flat = Settings.Secure.getString(
            context.getContentResolver(),
            "enabled_notification_listeners"
        );
        if (flat == null || flat.isEmpty()) return false;
        String[] names = flat.split(":");
        for (String name : names) {
            if (name != null && name.contains(pkg)) return true;
        }
        return false;
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
