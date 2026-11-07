package com.mespoches.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class FeedbackInboxReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        final Context app = context.getApplicationContext();
        String token = SmsAuthStore.getStoredToken(app);
        if (token == null || token.isEmpty()) return;
        FeedbackInboxScheduler.scheduleNext(app);
        new Thread(() -> FeedbackInboxPoller.check(app)).start();
    }
}
