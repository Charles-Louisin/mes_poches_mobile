package com.mespoches.app;

import android.content.Context;
import android.net.Uri;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.io.File;
import java.util.concurrent.TimeUnit;

/** OCR imprimé (ML Kit) — sans envoi réseau. */
public final class ReceiptOcr {
    private ReceiptOcr() {}

    public static String recognize(Context ctx, String sourcePath) throws Exception {
        File source = resolveSource(sourcePath);
        if (!source.exists() || !source.isFile()) {
            throw new IllegalArgumentException("Image introuvable");
        }
        InputImage image = InputImage.fromFilePath(ctx, Uri.fromFile(source));
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        try {
            Text result = Tasks.await(recognizer.process(image), 20, TimeUnit.SECONDS);
            String text = result.getText();
            return text == null ? "" : text.trim();
        } finally {
            recognizer.close();
        }
    }

    private static File resolveSource(String sourcePath) {
        if (sourcePath == null || sourcePath.trim().isEmpty()) {
            throw new IllegalArgumentException("Image introuvable");
        }
        String path = sourcePath.trim();
        if (path.startsWith("file:")) {
            Uri uri = Uri.parse(path);
            String decoded = uri.getPath();
            if (decoded != null && !decoded.isEmpty()) {
                return new File(decoded);
            }
        }
        return new File(path);
    }
}
