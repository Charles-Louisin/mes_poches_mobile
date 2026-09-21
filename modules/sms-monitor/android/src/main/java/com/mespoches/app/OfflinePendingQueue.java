package com.mespoches.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
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
            String raw = prefs(ctx).getString(KEY, "[]");
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void save(Context ctx, JSONArray arr) {
        prefs(ctx).edit().putString(KEY, arr.toString()).apply();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(SmsAuthStore.PREFS, Context.MODE_PRIVATE);
    }
}
