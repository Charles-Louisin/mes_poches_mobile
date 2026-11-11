package expo.modules.smsmonitor

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.mespoches.app.DailyReminderScheduler
import com.mespoches.app.DownloadStore
import com.mespoches.app.FeedbackInboxPoller
import com.mespoches.app.FeedbackInboxScheduler
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

    // Canal de distribution écrit à la compilation (meta-data) : « play » ou « direct ».
    Function("getDistribution") {
      val ctx = appContext.reactContext
      if (ctx == null) {
        "direct"
      } else {
        try {
          val info = ctx.packageManager.getApplicationInfo(ctx.packageName, android.content.pm.PackageManager.GET_META_DATA)
          info.metaData?.getString("com.mespoches.DISTRIBUTION") ?: "direct"
        } catch (e: Exception) {
          "direct"
        }
      }
    }

    AsyncFunction("storeAuthToken") { token: String, apiUrl: String? ->
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SmsAuthStore.store(ctx, token, apiUrl)
      DailyReminderScheduler.scheduleNext(ctx)
      FeedbackInboxScheduler.scheduleNext(ctx)
      Thread {
        OfflinePendingQueue.flush(ctx)
        FeedbackInboxPoller.check(ctx)
      }.start()
    }

    AsyncFunction("clearAuthToken") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SmsAuthStore.clear(ctx)
      DailyReminderScheduler.cancel(ctx)
      FeedbackInboxScheduler.cancel(ctx)
    }

    AsyncFunction("scheduleInboxPoll") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      FeedbackInboxScheduler.scheduleNext(ctx)
    }

    AsyncFunction("checkInboxNow") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      FeedbackInboxPoller.check(ctx)
    }

    AsyncFunction("setInboxCursor") { lastAt: String ->
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SmsAuthStore.setInboxLastAt(ctx, lastAt)
    }

    AsyncFunction("getInboxCursor") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      mapOf("lastAt" to (SmsAuthStore.getInboxLastAt(ctx) ?: ""))
    }

    AsyncFunction("touchInboxHeartbeat") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      SmsAuthStore.touchInboxHeartbeat(ctx)
    }

    AsyncFunction("scheduleDailyReminder") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      DailyReminderScheduler.scheduleNext(ctx)
    }

    AsyncFunction("isNotificationListenerEnabled") {
      val ctx = appContext.reactContext ?: return@AsyncFunction mapOf("enabled" to false, "connected" to false)
      try {
        mapOf(
          "enabled" to SmsAuthStore.isNotificationListenerEnabled(ctx),
          "connected" to SmsAuthStore.isListenerConnected(ctx)
        )
      } catch (e: Exception) {
        mapOf("enabled" to false, "connected" to false)
      }
    }

    AsyncFunction("rebindNotificationListener") {
      val ctx = appContext.reactContext ?: return@AsyncFunction null
      try {
        // Inutile (et refusé par le système) si l'accès n'est pas accordé.
        if (SmsAuthStore.isNotificationListenerEnabled(ctx)) SmsAuthStore.requestListenerRebind(ctx)
      } catch (e: Exception) {
        // accès révoqué ou restreint : la détection reste simplement inactive
      }
      null
    }

    // Ouverture des réglages : ne lève jamais d'exception (écran absent sur certaines surcouches Android).
    // Renvoie true si un écran a pu s'ouvrir.
    AsyncFunction("openAppDetailsSettings") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        intent.data = Uri.parse("package:${ctx.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("openNotificationAccessSettings") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        true
      } catch (e: Exception) {
        // Repli : fiche de l'application (l'utilisateur y trouve « Notifications » / « Paramètres restreints »).
        try {
          val details = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          details.data = Uri.parse("package:${ctx.packageName}")
          details.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          ctx.startActivity(details)
          true
        } catch (e2: Exception) {
          false
        }
      }
    }

    AsyncFunction("showTransactionReady") { message: String ->
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      MesPochesNotifier.showReady(ctx, message)
    }

    AsyncFunction("saveToDownloads") { sourcePath: String, filename: String, mimeType: String? ->
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      mapOf("uri" to DownloadStore.save(ctx, sourcePath, filename, mimeType))
    }

    AsyncFunction("listOfflineQueue") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      OfflinePendingQueue.listItems(ctx)
    }

    AsyncFunction("flushOfflineQueue") {
      val ctx = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      Thread { OfflinePendingQueue.flush(ctx) }.start()
    }
  }
}
