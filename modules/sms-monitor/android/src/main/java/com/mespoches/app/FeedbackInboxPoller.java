package com.mespoches.app;

import android.content.Context;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Vérifie la messagerie et affiche une notif locale (sans FCM). */
public final class FeedbackInboxPoller {
    private static final String TAG = "MesPochesInbox";

    private FeedbackInboxPoller() {}

    public static void check(Context ctx) {
        Context app = ctx.getApplicationContext();
        String token = SmsAuthStore.getStoredToken(app);
        String apiBase = SmsAuthStore.getApiBase(app);
        if (token == null || token.isEmpty() || apiBase == null || apiBase.isEmpty()) return;

        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiBase + "/feedback/inbox-ping");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(12000);
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return;
            String body = readBody(conn);
            int unread = jsonInt(body, "unread");
            String lastAt = jsonString(body, "lastAt");
            String preview = jsonString(body, "preview");
            String role = jsonString(body, "role");
            String userId = jsonString(body, "userId");

            String stored = SmsAuthStore.getInboxLastAt(app);
            if (unread <= 0 || lastAt == null || lastAt.isEmpty()) {
                if (lastAt != null && !lastAt.isEmpty()) {
                    SmsAuthStore.setInboxLastAt(app, lastAt);
                }
                return;
            }
            if (stored != null && !stored.isEmpty() && lastAt.compareTo(stored) <= 0) return;

            SmsAuthStore.setInboxLastAt(app, lastAt);
            if (SmsAuthStore.isJsInboxActive(app)) return;

            boolean admin = "admin".equals(role);
            String title = admin ? "Nouveau message" : "Réponse de Mes Poches";
            String text = preview == null || preview.isEmpty()
                ? (admin ? "Un utilisateur vous a écrit." : "Vous avez un nouveau message.")
                : preview;
            String link = admin && userId != null && !userId.isEmpty()
                ? "mespoches://admin-messages/" + userId
                : "mespoches://feedback";
            MesPochesNotifier.showInbox(app, title, text, link);
        } catch (Exception e) {
            Log.w(TAG, "inbox ping failed", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String readBody(HttpURLConnection conn) {
        try (InputStream is = conn.getInputStream();
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static int jsonInt(String json, String key) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\\d+)").matcher(json);
        if (!m.find()) return 0;
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String jsonString(String json, String key) {
        Matcher m = Pattern.compile(
            "\"" + Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\""
        ).matcher(json);
        if (!m.find()) return "";
        return m.group(1)
            .replace("\\\"", "\"")
            .replace("\\n", " ")
            .replace("\\\\", "\\");
    }
}
