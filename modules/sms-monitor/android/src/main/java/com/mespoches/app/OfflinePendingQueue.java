package com.mespoches.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** File locale des POST SMS/notif échoués hors ligne. */
public final class OfflinePendingQueue {
    private static final String TAG = "MesPochesOffline";
    private static final String KEY = "offline_posts";

    private OfflinePendingQueue() {}

    public static void enqueue(Context ctx, String url, String json, String fingerprint) {
        try {
            JSONArray arr = load(ctx);
            JSONObject item = new JSONObject();
            item.put("url", url);
            item.put("json", json);
            item.put("fingerprint", fingerprint == null ? "" : fingerprint);
            arr.put(item);
            save(ctx, arr);
            Log.i(TAG, "Queued offline pending post (" + arr.length() + ")");
        } catch (Exception e) {
            Log.e(TAG, "enqueue failed", e);
        }
    }

    public static List<Map<String, String>> listItems(Context ctx) {
        JSONArray arr = load(ctx);
        List<Map<String, String>> out = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            try {
                JSONObject item = arr.getJSONObject(i);
                Map<String, String> map = new HashMap<>();
                map.put("url", item.optString("url", ""));
                map.put("json", item.optString("json", ""));
                map.put("fingerprint", item.optString("fingerprint", ""));
                out.add(map);
            } catch (Exception ignored) {
                /* skip */
            }
        }
        return out;
    }

    public static void flush(Context ctx) {
        String token = SmsAuthStore.getStoredToken(ctx);
        String apiBase = SmsAuthStore.getApiBase(ctx);
        if (token == null || token.isEmpty()) return;
        JSONArray arr = load(ctx);
        if (arr.length() == 0) return;
        JSONArray leftover = new JSONArray();
        for (int i = 0; i < arr.length(); i++) {
            try {
                JSONObject item = arr.getJSONObject(i);
                String url = item.optString("url", "");
                String json = item.optString("json", "");
                String fp = item.optString("fingerprint", "");
                if (url.isEmpty() || json.isEmpty()) continue;
                int result = PendingApiPoster.postOnce(ctx, url, token, json, fp);
                if (result < 0) leftover.put(item);
            } catch (Exception e) {
                try {
                    leftover.put(arr.getJSONObject(i));
                } catch (Exception ignored) {
                    /* skip */
                }
            }
        }
        save(ctx, leftover);
    }

    private static JSONArray load(Context ctx) {
        try {
            String raw = readQueueFile(ctx);
            if (raw == null || raw.isEmpty()) {
                raw = prefs(ctx).getString(KEY, "[]");
            }
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void save(Context ctx, JSONArray arr) {
        String raw = arr.toString();
        prefs(ctx).edit().putString(KEY, raw).commit();
        writeQueueFile(ctx, raw);
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(SmsAuthStore.PREFS, Context.MODE_PRIVATE);
    }

    private static java.io.File queueFile(Context ctx) {
        return new java.io.File(ctx.getApplicationContext().getFilesDir(), "mespoches_offline_queue.json");
    }

    private static String readQueueFile(Context ctx) {
        java.io.File file = queueFile(ctx);
        if (!file.exists()) return null;
        try (java.io.FileInputStream in = new java.io.FileInputStream(file)) {
            byte[] buf = new byte[(int) file.length()];
            int n = in.read(buf);
            if (n <= 0) return null;
            return new String(buf, 0, n, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private static void writeQueueFile(Context ctx, String raw) {
        try {
            java.io.File dest = queueFile(ctx);
            java.io.File tmp = new java.io.File(dest.getAbsolutePath() + ".tmp");
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(tmp)) {
                out.write(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                out.flush();
            }
            if (!tmp.renameTo(dest) && dest.exists()) {
                Log.w(TAG, "queue file rename failed");
            }
        } catch (Exception e) {
            Log.w(TAG, "queue file write failed", e);
        }
    }
}
