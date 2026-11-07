package com.mespoches.app;

import android.app.Notification;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.StatusBarNotification;

/** Extrait tout le texte visible d'une notification Android. */
public final class NotificationTextExtractor {
    private NotificationTextExtractor() {}

    public static String extract(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return "";
        try {
            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            if (extras == null) return "";

            StringBuilder sb = new StringBuilder();
            append(sb, extras.getCharSequence(Notification.EXTRA_TITLE));
            append(sb, extras.getCharSequence(Notification.EXTRA_TEXT));
            append(sb, extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            append(sb, extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
            append(sb, extras.getCharSequence(Notification.EXTRA_INFO_TEXT));
            append(sb, extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT));
            append(sb, extras.getCharSequence(Notification.EXTRA_TITLE_BIG));

            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null) {
                for (CharSequence line : lines) {
                    append(sb, line);
                }
            }

            // Google Messages / SMS OEM : le corps est dans EXTRA_MESSAGES, pas EXTRA_TEXT.
            appendMessageBundles(sb, messageBundles(extras, Notification.EXTRA_MESSAGES));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appendMessageBundles(sb, messageBundles(extras, Notification.EXTRA_HISTORIC_MESSAGES));
            }

            return sb.toString().trim();
        } catch (Exception e) {
            return "";
        }
    }

    private static Parcelable[] messageBundles(Bundle extras, String key) {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                return extras.getParcelableArray(key, Bundle.class);
            }
            return extras.getParcelableArray(key);
        } catch (Exception e) {
            return null;
        }
    }

    private static void appendMessageBundles(StringBuilder sb, Parcelable[] messages) {
        if (messages == null) return;
        try {
            for (Parcelable item : messages) {
                if (!(item instanceof Bundle)) continue;
                Bundle bundle = (Bundle) item;
                append(sb, bundle.getCharSequence("text"));
            }
        } catch (Exception ignored) {
            /* extras MessagingStyle parfois illisibles (Android 15+) */
        }
    }

    public static String title(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return "";
        Bundle extras = sbn.getNotification().extras;
        if (extras == null) return "";
        CharSequence t = extras.getCharSequence(Notification.EXTRA_TITLE);
        return t != null ? t.toString().trim() : "";
    }

    private static void append(StringBuilder sb, CharSequence cs) {
        if (cs == null) return;
        String part = cs.toString().trim();
        if (part.isEmpty()) return;
        if (sb.length() > 0) sb.append(' ');
        sb.append(part);
    }
}
