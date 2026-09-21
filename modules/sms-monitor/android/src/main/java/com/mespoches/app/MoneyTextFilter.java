package com.mespoches.app;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Niveau 1 — filtre rapide sans IA (package + mots-clés). */
public final class MoneyTextFilter {
    private MoneyTextFilter() {}

    private static final String[] KEYWORDS = {
        "fcfa", "xaf", "cfa", "€", "eur", "euro", "usd", "$", "dollar", "franc",
        "montant", "amount", "solde", "balance", "compte", "account",
        "paiement", "payment", "payé", "paye", "paid", "payez",
        "transfert", "transfer", "virement", "envoyé", "envoye", "sent", "received", "reçu", "recu",
        "retrait", "withdrawal", "withdraw", "dépôt", "depot", "deposit",
        "débit", "debit", "crédit", "credit", "debited", "credited",
        "transaction", "opération", "operation", "achat", "purchase", "facture", "invoice",
        "receipt", "ticket", "carte", "card", "bank", "banque",
        "prélèvement", "prelevement", "mobile money", "momo", "wallet", "portefeuille",
        "cash", "argent", "money", "fee", "frais", "commission", "taxe",
        "reussi", "success", "successful", "confirmé", "confirme", "confirmed",
        "orange money", "orangemoney", "mtn", "express union", "uba", "ecobank",
        "afriland", "scb", "bicec", "wave"
    };

    /** Apps portefeuille / banque / fintech — pas de messagerie grand public. */
    private static final Set<String> MONEY_PACKAGES = new HashSet<>(Arrays.asList(
        "com.orange.money",
        "com.orange.omcm",
        "cm.orange.om",
        "com.mtn.momo",
        "com.mtn.momocm",
        "com.wave.personal",
        "com.ecobank.mobile",
        "com.ubagroup.uba",
        "com.afrilandfirstbank.mobile",
        "cm.bicec.mobile",
        "com.moovmoney",
        "cm.yup.mobile",
        "com.expressunion.mobile",
        "com.paypal.android.p2pmobile",
        "com.revolut.revolut",
        "com.wise.android",
        "com.google.android.apps.walletnfcrel"
    ));

    /** Chat, mail, réseaux : jamais lus. */
    private static final Set<String> BLOCKED_PACKAGES = new HashSet<>(Arrays.asList(
        "com.whatsapp",
        "com.whatsapp.w4b",
        "com.google.android.gm",
        "com.google.android.gm.lite",
        "com.facebook.orca",
        "com.facebook.katana",
        "org.telegram.messenger",
        "com.instagram.android",
        "com.twitter.android",
        "com.zhiliaoapp.musically",
        "com.snapchat.android",
        "com.viber.voip",
        "org.thoughtcrime.securesms",
        "com.discord",
        "com.slack",
        "com.microsoft.office.outlook",
        "com.yahoo.mobile.client.android.mail"
    ));

    public static boolean isBlockedPackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        String p = packageName.toLowerCase(Locale.ROOT);
        for (String known : BLOCKED_PACKAGES) {
            if (p.equals(known) || p.startsWith(known + ".")) return true;
        }
        return false;
    }

    public static boolean isSmsPackage(String packageName) {
        if (packageName == null) return false;
        return packageName.equals("com.android.messaging") ||
               packageName.equals("com.google.android.apps.messaging") ||
               packageName.equals("com.samsung.android.messaging") ||
               packageName.equals("com.sonyericsson.conversations") ||
               packageName.equals("com.motorola.messaging") ||
               packageName.equals("com.android.mms") ||
               packageName.contains(".mms") ||
               packageName.contains(".sms");
    }

    public static boolean isMoneyPackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        if (isBlockedPackage(packageName)) return false;
        String p = packageName.toLowerCase(Locale.ROOT);
        for (String known : MONEY_PACKAGES) {
            if (p.equals(known) || p.startsWith(known)) return true;
        }
        return p.contains("momo")
            || p.contains("orangemoney")
            || p.contains("mobilemoney")
            || p.contains(".bank")
            || p.contains("banque");
    }

    /** SMS messagerie + apps de transfert / banque / fintech — jamais WhatsApp, Gmail, etc. */
    public static boolean isAllowedCapturePackage(String packageName) {
        if (isBlockedPackage(packageName)) return false;
        return isSmsPackage(packageName) || isMoneyPackage(packageName);
    }

    public static boolean isMoneyRelated(String raw) {
        return isMoneyRelated(raw, null);
    }

    public static boolean isMoneyRelated(String raw, String packageName) {
        if (isBlockedPackage(packageName)) return false;
        if (isMoneyPackage(packageName)) return true;
        return hasMoneySignal(raw);
    }

    private static boolean hasMoneySignal(String raw) {
        if (raw == null) return false;
        String text = raw.trim();
        if (text.length() < 4) return false;

        String lower = text.toLowerCase(Locale.ROOT);

        for (String keyword : KEYWORDS) {
            if (lower.contains(keyword)) {
                return true;
            }
        }

        Pattern currencyAmount = Pattern.compile(
            "(?i)(\\d{1,3}([\\s.,]\\d{3})+|\\d+)([\\s.,]\\d{1,2})?\\s*(fcfa|xaf|cfa|€|eur|euro|euros|\\$|usd|dollar|dollars|£|gbp|francs?|f\\s*cfa)"
        );
        return currencyAmount.matcher(lower).find();
    }
}
