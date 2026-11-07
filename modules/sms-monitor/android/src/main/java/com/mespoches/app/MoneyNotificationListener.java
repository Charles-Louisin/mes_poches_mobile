package com.mespoches.app;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MoneyNotificationListener extends NotificationListenerService {
    private static final String TAG = "MesPochesNotif";
    /** Évite re-posts Android (updates) et SMS+notif quasi simultanés. */
    private static final long DEBOUNCE_MS = 90_000L;
    private static final long SCAN_LOOKBACK_MS = 15 * 60 * 1000L;
    private static final ConcurrentHashMap<String, Long> RECENT_KEYS = new ConcurrentHashMap<>();

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        Log.i(TAG, "Notification listener connected");
        try {
            SmsAuthStore.setListenerConnected(this, true);
        } catch (Throwable e) {
            Log.e(TAG, "setListenerConnected failed", e);
        }
        try {
            scanRecentActive();
        } catch (Throwable e) {
            Log.e(TAG, "scan active notifications failed", e);
        }
    }

    @Override
    public void onListenerDisconnected() {
        try {
            SmsAuthStore.setListenerConnected(this, false);
        } catch (Throwable ignored) {
            /* le process peut déjà être en train de mourir */
        }
        super.onListenerDisconnected();
        Log.w(TAG, "Notification listener disconnected");
        try {
            SmsAuthStore.requestListenerRebind(this);
        } catch (Throwable ignored) {
            /* requestRebind est le seul appel sûr ici */
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            handlePosted(sbn);
        } catch (Throwable e) {
            Log.e(TAG, "Ignored notification (listener must stay alive)", e);
        }
    }

    private void scanRecentActive() {
        StatusBarNotification[] active = getActiveNotifications();
        if (active == null || active.length == 0) return;
        long cutoff = System.currentTimeMillis() - SCAN_LOOKBACK_MS;
        int scanned = 0;
        for (StatusBarNotification sbn : active) {
            if (sbn == null) continue;
            if (sbn.getPostTime() < cutoff) continue;
            handlePosted(sbn);
            scanned++;
            if (scanned >= 20) break;
        }
    }

    private void handlePosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        // Ne jamais ré-analyser nos propres notifications (boucle "transaction" / montants).
        String packageName = sbn.getPackageName();
        if (packageName != null && packageName.equals(getPackageName())) {
            return;
        }
        if (sbn.isOngoing()) return;

        // SÉCURITÉ : SMS + fintech / banques uniquement (jamais WhatsApp, Gmail, …)
        if (!MoneyTextFilter.isAllowedCapturePackage(this, packageName)) {
            return;
        }

        String token = SmsAuthStore.getStoredToken(this);
        if (token == null || token.isEmpty()) {
            Log.w(TAG, "Skip notification: no auth token stored");
            return;
        }

        String fullText = NotificationTextExtractor.extract(sbn);
        if (fullText.isEmpty()) return;

        if (!MoneyTextFilter.isMoneyRelated(fullText, packageName)) {
            return;
        }

        String debounceKey = "txt|" + Integer.toHexString(fullText.hashCode());
        String fp = contentFingerprint(fullText);
        if (claimEvent(this, debounceKey, fp)) {
            if (Log.isLoggable(TAG, Log.DEBUG)) {
                Log.d(TAG, "Skip duplicate notification event");
            }
            return;
        }

        String title = NotificationTextExtractor.title(sbn);
        String body = fullText;
        if (!title.isEmpty() && body.toLowerCase().startsWith(title.toLowerCase())) {
            body = body.substring(title.length()).trim();
        }
        if (body.isEmpty()) body = fullText;

        Log.i(TAG, "Money notification detected pkg=" + packageName);

        final String fTitle = title.isEmpty() ? "Notification" : title;
        final String fBody = body;
        final String fPackage = packageName == null ? "" : packageName;
        final String fFingerprint = fp;
        final String authToken = token;
        final String apiBase = SmsAuthStore.getApiBase(this);

        new Thread(() ->
            PendingApiPoster.postNotification(
                MoneyNotificationListener.this, apiBase, authToken, fTitle, fBody, fPackage, fFingerprint)
        ).start();
    }

    /** Partagé avec SmsReceiver (process UI) — fichier pour le process :notif. */
    static boolean claimEvent(String primaryKey, String contentFingerprint) {
        return claimEvent(null, primaryKey, contentFingerprint);
    }

    static boolean claimEvent(android.content.Context context, String primaryKey, String contentFingerprint) {
        long now = System.currentTimeMillis();
        pruneOld(now);

        boolean duplicate = false;
        if (contentFingerprint != null && !contentFingerprint.isEmpty()) {
            String fpKey = "fp|" + contentFingerprint;
            Long prevFp = RECENT_KEYS.put(fpKey, now);
            if (prevFp != null && (now - prevFp) < DEBOUNCE_MS) {
                duplicate = true;
            }
        }

        if (!duplicate && primaryKey != null && !primaryKey.isEmpty()) {
            Long prev = RECENT_KEYS.put(primaryKey, now);
            if (prev != null && (now - prev) < DEBOUNCE_MS) {
                duplicate = true;
            }
        }

        if (context != null && !duplicate) {
            duplicate = claimOnDisk(context, primaryKey, contentFingerprint, now);
        }
        return duplicate;
    }

    /** Annule le claim (échec parse) pour laisser passer une mise à jour plus complète. */
    static void releaseFingerprint(String contentFingerprint) {
        releaseFingerprint(null, contentFingerprint);
    }

    static void releaseFingerprint(android.content.Context context, String contentFingerprint) {
        if (contentFingerprint == null || contentFingerprint.isEmpty()) return;
        RECENT_KEYS.remove("fp|" + contentFingerprint);
        if (context == null) return;
        try {
            java.io.File dest = claimFile(context);
            if (!dest.exists()) return;
            java.util.HashMap<String, Long> map = readClaims(dest);
            map.remove("fp|" + contentFingerprint);
            writeClaims(dest, map);
        } catch (Exception ignored) {
            /* ignore */
        }
    }

    private static java.io.File claimFile(android.content.Context context) {
        return new java.io.File(context.getApplicationContext().getFilesDir(), "mespoches_claims.txt");
    }

    private static synchronized boolean claimOnDisk(
            android.content.Context context, String primaryKey, String contentFingerprint, long now) {
        try {
            java.io.File dest = claimFile(context);
            java.util.HashMap<String, Long> map = readClaims(dest);
            java.util.Iterator<java.util.Map.Entry<String, Long>> it = map.entrySet().iterator();
            while (it.hasNext()) {
                java.util.Map.Entry<String, Long> e = it.next();
                if (now - e.getValue() > DEBOUNCE_MS * 2) it.remove();
            }
            if (contentFingerprint != null && !contentFingerprint.isEmpty()) {
                Long prev = map.get("fp|" + contentFingerprint);
                if (prev != null && (now - prev) < DEBOUNCE_MS) return true;
                map.put("fp|" + contentFingerprint, now);
            }
            if (primaryKey != null && !primaryKey.isEmpty()) {
                Long prev = map.get(primaryKey);
                if (prev != null && (now - prev) < DEBOUNCE_MS) {
                    writeClaims(dest, map);
                    return true;
                }
                map.put(primaryKey, now);
            }
            writeClaims(dest, map);
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private static java.util.HashMap<String, Long> readClaims(java.io.File dest) {
        java.util.HashMap<String, Long> map = new java.util.HashMap<>();
        if (!dest.exists()) return map;
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
            new java.io.InputStreamReader(new java.io.FileInputStream(dest), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                int sep = line.lastIndexOf('|');
                if (sep <= 0) continue;
                try {
                    map.put(line.substring(0, sep), Long.parseLong(line.substring(sep + 1)));
                } catch (NumberFormatException ignored) {
                    /* skip */
                }
            }
        } catch (Exception ignored) {
            /* ignore */
        }
        return map;
    }

    private static void writeClaims(java.io.File dest, java.util.HashMap<String, Long> map) throws Exception {
        java.io.File tmp = new java.io.File(dest.getAbsolutePath() + ".tmp");
        try (java.io.FileOutputStream out = new java.io.FileOutputStream(tmp)) {
            StringBuilder sb = new StringBuilder();
            for (java.util.Map.Entry<String, Long> e : map.entrySet()) {
                if (e.getKey().contains("\n") || e.getKey().contains("\r")) continue;
                sb.append(e.getKey()).append('|').append(e.getValue()).append('\n');
            }
            out.write(sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            out.flush();
        }
        if (!tmp.renameTo(dest) && dest.exists()) {
            Log.w(TAG, "claim file rename failed");
        }
    }

    /** Clé stable basée sur montants / ID présents dans le texte. */
    static String contentFingerprint(String text) {
        if (text == null) return "";
        String lower = text.toLowerCase().replaceAll("\\s+", " ").trim();
        StringBuilder sb = new StringBuilder();
        java.util.regex.Matcher id = java.util.regex.Pattern
            .compile("(?:id(?:\\s+de)?\\s+transaction\\s*:\\s*|transaction\\s+id\\s*:\\s*|\\b(?:pp|mp|co)\\d{6}\\.\\d{4}\\.[a-z0-9.]+)",
                java.util.regex.Pattern.CASE_INSENSITIVE)
            .matcher(lower);
        if (id.find()) {
            sb.append("id:").append(id.group().replaceAll("\\s+", "")).append('|');
        }
        java.util.regex.Matcher amounts = java.util.regex.Pattern
            .compile("(\\d{1,3}([\\s.,]\\d{3})+|\\d+)([\\s.,]\\d{1,2})?\\s*(fcfa|xaf|cfa|f\\b)")
            .matcher(lower);
        int n = 0;
        while (amounts.find() && n < 3) {
            sb.append(amounts.group().replaceAll("\\s+", "")).append('|');
            n++;
        }
        if (sb.length() == 0) {
            // Fallback : empreinte courte du texte normalisé
            sb.append(lower.replaceAll("\\d", "#").substring(0, Math.min(120, lower.length())));
        }
        return sb.toString();
    }

    private static void pruneOld(long now) {
        if (RECENT_KEYS.size() < 80) return;
        Iterator<Map.Entry<String, Long>> it = RECENT_KEYS.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Long> e = it.next();
            if (now - e.getValue() > DEBOUNCE_MS * 2) {
                it.remove();
            }
        }
    }
}
