package com.mespoches.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import expo.modules.smsmonitor.R;

/** Notifications locales MES POCHES (transaction prête). */
public final class MesPochesNotifier {
    private static final String CHANNEL_ID = "mes_poches_transactions";
    private static final String REMINDER_CHANNEL = "mes_poches_reminders";
    private static final String MESSAGE_CHANNEL = "mes_poches_messages";
    private static final int ID_PROCESSING = 8001;
    private static final int ID_READY = 8002;
    private static final int ID_REMINDER = 8003;
    private static final int ID_INBOX = 8004;
    private static final int ID_BATCH = 8005;
    private static final String BATCH_CHANNEL = "mes_poches_batch";

    private MesPochesNotifier() {}

    public static void showReady(Context ctx, String message) {
        ensureChannel(ctx);
        NotificationManager nm = notificationManager(ctx);
        nm.cancel(ID_PROCESSING);

        Intent intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (intent == null) {
            intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            intent.setPackage(ctx.getPackageName());
        }
        intent.setData(Uri.parse("mespoches://pending"));
        intent.putExtra("openPending", true);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(ctx, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_mp)
            .setContentTitle("Transaction prête")
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);
        nm.notify(ID_READY, builder.build());
    }

    public static void showReminder(Context ctx, int pendingCount) {
        ensureReminderChannel(ctx);
        Intent intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (intent == null) {
            intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            intent.setPackage(ctx.getPackageName());
        }
        if (pendingCount > 0) intent.setData(Uri.parse("mespoches://pending"));
        intent.putExtra("openPending", pendingCount > 0);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(ctx, 1, intent, flags);

        String title = pendingCount > 0 ? "Transactions à valider" : "Pensez à Mes Poches";
        String text = pendingCount > 0
            ? (pendingCount == 1
                ? "Il vous reste 1 transaction à valider dans l’application."
                : "Il vous reste " + pendingCount + " transactions à valider dans l’application.")
            : "N’oubliez pas d’enregistrer vos transactions du jour.";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, REMINDER_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_mp)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);
        notificationManager(ctx).notify(ID_REMINDER, builder.build());
    }

    public static void showInbox(Context ctx, String title, String message, String deepLink) {
        ensureMessageChannel(ctx);
        Intent intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (intent == null) {
            intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            intent.setPackage(ctx.getPackageName());
        }
        String link = deepLink == null || deepLink.isEmpty() ? "mespoches://feedback" : deepLink;
        intent.setData(Uri.parse(link));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(ctx, 4, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, MESSAGE_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_mp)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);
        notificationManager(ctx).notify(ID_INBOX, builder.build());
    }

    /** Barre de progression de l'enregistrement en arrière-plan (silencieuse, non effaçable tant qu'elle tourne). */
    public static void showBatchProgress(Context ctx, int percent, int done, int total) {
        ensureBatchChannel(ctx);
        Intent intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = intent == null ? null : PendingIntent.getActivity(ctx, 5, intent, flags);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, BATCH_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_mp)
            .setContentTitle("Enregistrement des transactions")
            .setContentText(done + " sur " + total + " · " + percent + " %")
            .setProgress(100, Math.max(0, Math.min(100, percent)), false)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (pi != null) builder.setContentIntent(pi);
        notificationManager(ctx).notify(ID_BATCH, builder.build());
    }

    public static void cancelBatch(Context ctx) {
        notificationManager(ctx).cancel(ID_BATCH);
    }

    private static void ensureBatchChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            BATCH_CHANNEL,
            "Enregistrements en cours",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Progression des enregistrements faits en arrière-plan");
        channel.setShowBadge(false);
        notificationManager(ctx).createNotificationChannel(channel);
    }

    public static void cancelProcessing(Context ctx) {
        notificationManager(ctx).cancel(ID_PROCESSING);
    }

    private static NotificationManager notificationManager(Context ctx) {
        return (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = notificationManager(ctx);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Transactions détectées",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alertes lors de la détection Mobile Money");
        nm.createNotificationChannel(channel);
    }

    private static void ensureReminderChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = notificationManager(ctx);
        NotificationChannel channel = new NotificationChannel(
            REMINDER_CHANNEL,
            "Rappels quotidiens",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Rappel de 19 h pour enregistrer ou valider vos transactions");
        nm.createNotificationChannel(channel);
    }

    private static void ensureMessageChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = notificationManager(ctx);
        NotificationChannel channel = new NotificationChannel(
            MESSAGE_CHANNEL,
            "Messages",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Nouveaux messages de la messagerie Mes Poches");
        nm.createNotificationChannel(channel);
    }
}
