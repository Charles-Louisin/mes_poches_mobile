package expo.modules.smsmonitor

import android.content.Intent
import android.provider.Settings
import com.mespoches.app.DailyReminderScheduler
import com.mespoches.app.DownloadStore
import com.mespoches.app.MesPochesNotifier
import com.mespoches.app.OfflinePendingQueue
import com.mespoches.app.SmsAuthStore
import com.mespoches.app.SmsMonitorEvents
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsMonitorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsMonitor")

    Events("onPendingDuplicate")

    OnCreate {
      SmsMonitorEvents.emitter = SmsMonitorEvents.Emitter { name, payload ->
        sendEvent(name, payload)
      }
    }

    OnDestroy {
      SmsMonitorEvents.emitter = null
    }

    AsyncFunction("storeAuthToken") { token: String, apiUrl: String? ->
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SmsAuthStore.store(ctx, token, apiUrl)
      DailyReminderScheduler.scheduleNext(ctx)
      Thread { OfflinePendingQueue.flush(ctx) }.start()
    }

    AsyncFunction("clearAuthToken") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SmsAuthStore.clear(ctx)
      DailyReminderScheduler.cancel(ctx)
    }

    AsyncFunction("scheduleDailyReminder") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      DailyReminderScheduler.scheduleNext(ctx)
    }

    AsyncFunction("isNotificationListenerEnabled") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      mapOf("enabled" to SmsAuthStore.isNotificationListenerEnabled(ctx))
    }

    AsyncFunction("openNotificationAccessSettings") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
    }

    AsyncFunction("showTransactionReady") { message: String ->
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      MesPochesNotifier.showReady(ctx, message)
    }

    AsyncFunction("saveToDownloads") { sourcePath: String, filename: String, mimeType: String? ->
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      mapOf("uri" to DownloadStore.save(ctx, sourcePath, filename, mimeType))
    }
  }
}
