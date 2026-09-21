package com.mespoches.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.util.Calendar;

public final class DailyReminderScheduler {
    private static final int REQ = 9101;
    private static final int HOUR = 20;
    private static final int MINUTE = 0;

    private DailyReminderScheduler() {}

    public static void scheduleNext(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(ctx, DailyReminderReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(ctx, REQ, intent, flags);

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, HOUR);
        cal.set(Calendar.MINUTE, MINUTE);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1);
        }

        long at = cal.getTimeInMillis();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    public static void cancel(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent intent = new Intent(ctx, DailyReminderReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        am.cancel(PendingIntent.getBroadcast(ctx, REQ, intent, flags));
    }
}
