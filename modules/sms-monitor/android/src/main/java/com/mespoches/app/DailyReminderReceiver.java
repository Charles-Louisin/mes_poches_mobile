package com.mespoches.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Déclenché chaque jour à 19 h. */
public class DailyReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context app = context.getApplicationContext();
        DailyReminderScheduler.scheduleNext(app);
        new Thread(() -> {
            int count = PendingApiPoster.fetchPendingCount(app);
            MesPochesNotifier.showReminder(app, Math.max(0, count));
        }).start();
    }
}
