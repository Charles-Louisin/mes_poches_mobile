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

/**
 * Suit un enregistrement en lot côté serveur et met à jour la barre de progression de la notification,
 * même quand l'app est en arrière-plan. Les chiffres viennent du serveur (aucune estimation).
 * La notification de fin est envoyée par le serveur (push), celle-ci est simplement retirée.
 */
public final class BatchJobTracker {
    private static final String TAG = "MesPochesBatch";
    private static final long INTERVAL_MS = 900;
    private static final long MAX_MS = 20 * 60 * 1000;
    private static volatile String activeJob = null;

    private BatchJobTracker() {}

    public static void track(Context ctx, String jobId) {
        final Context app = ctx.getApplicationContext();
        activeJob = jobId;
        Thread t = new Thread(() -> run(app, jobId), "mespoches-batch");
        t.setDaemon(true);
        t.start();
    }

    public static void stop(Context ctx) {
        activeJob = null;
        MesPochesNotifier.cancelBatch(ctx.getApplicationContext());
    }

    private static void run(Context app, String jobId) {
        long started = System.currentTimeMillis();
        int failures = 0;
        while (jobId.equals(activeJob) && System.currentTimeMillis() - started < MAX_MS) {
            String body = fetch(app, jobId);
            if (body == null) {
                if (++failures > 20) break;
            } else {
                failures = 0;
                int percent = jsonInt(body, "percent");
                int done = jsonInt(body, "done") + jsonInt(body, "failed");
                int total = jsonInt(body, "total");
                String status = jsonString(body, "status");
                if ("done".equals(status)) break;
                MesPochesNotifier.showBatchProgress(app, percent, done, total);
            }
            try {
                Thread.sleep(INTERVAL_MS);
            } catch (InterruptedException e) {
                break;
            }
        }
        if (jobId.equals(activeJob)) activeJob = null;
        MesPochesNotifier.cancelBatch(app);
    }

    private static String fetch(Context app, String jobId) {
        String token = SmsAuthStore.getStoredToken(app);
        String apiBase = SmsAuthStore.getApiBase(app);
        if (token == null || token.isEmpty() || apiBase == null || apiBase.isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiBase + "/transactions/batch/" + jobId);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return null;
            try (InputStream is = conn.getInputStream();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                return sb.toString();
            }
        } catch (Exception e) {
            Log.w(TAG, "batch poll failed", e);
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static int jsonInt(String body, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)").matcher(body);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private static String jsonString(String body, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"").matcher(body);
        return m.find() ? m.group(1) : null;
    }
}
