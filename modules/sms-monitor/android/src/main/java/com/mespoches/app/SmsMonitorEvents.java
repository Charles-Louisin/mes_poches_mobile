package com.mespoches.app;

import java.util.HashMap;
import java.util.Map;

/** Pont vers l’événement JS onPendingDuplicate. */
public final class SmsMonitorEvents {
    public interface Emitter {
        void emit(String name, Map<String, Object> payload);
    }

    public static volatile Emitter emitter;

    private SmsMonitorEvents() {}

    public static void duplicate(boolean alreadyValidated) {
        Emitter e = emitter;
        if (e == null) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("alreadyValidated", alreadyValidated);
        e.emit("onPendingDuplicate", payload);
    }
}
