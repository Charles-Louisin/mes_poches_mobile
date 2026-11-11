package com.mespoches.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Au démarrage du téléphone ou après une mise à jour de l'app : reprogramme le rappel du soir
 * et la vérification des messages, puis renvoie les propositions restées en file hors ligne.
 * L'app ne lit pas les SMS : la détection passe uniquement par l'accès aux notifications.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!"android.intent.action.BOOT_COMPLETED".equals(action)
                && !"android.intent.action.MY_PACKAGE_REPLACED".equals(action)) {
            return;
        }

        String token = SmsAuthStore.getStoredToken(context);
        if (token == null || token.isEmpty()) return;

        final Context app = context.getApplicationContext();
        DailyReminderScheduler.scheduleNext(app);
        FeedbackInboxScheduler.scheduleNext(app);
        new Thread(() -> {
            OfflinePendingQueue.flush(app);
            FeedbackInboxPoller.check(app);
        }).start();
    }
}
