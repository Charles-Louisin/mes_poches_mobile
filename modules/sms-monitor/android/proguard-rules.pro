# Le système instancie ces classes depuis le manifeste. R8 ne doit pas les retirer.
-keep class com.mespoches.app.** { *; }
-keep class * extends android.service.notification.NotificationListenerService { *; }
-keepclassmembers class com.mespoches.app.MoneyNotificationListener {
    public <init>();
}
-keepnames class com.mespoches.app.MoneyNotificationListener
-dontwarn androidx.security.crypto.**
