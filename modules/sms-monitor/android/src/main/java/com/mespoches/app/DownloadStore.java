package com.mespoches.app;

import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;

/** Copie un fichier local vers le dossier Téléchargements public. */
public final class DownloadStore {
    private DownloadStore() {}

    public static String save(Context ctx, String sourcePath, String filename, String mimeType) throws Exception {
        File source = resolveSource(sourcePath);
        if (!source.exists() || !source.isFile()) {
            throw new IllegalArgumentException("Fichier introuvable");
        }

        String safeName = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
        String mime = mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = ctx.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Impossible de créer le fichier");
            try (OutputStream out = ctx.getContentResolver().openOutputStream(uri);
                 FileInputStream in = new FileInputStream(source)) {
                if (out == null) throw new IllegalStateException("Écriture impossible");
                copy(in, out);
            } catch (Exception e) {
                ctx.getContentResolver().delete(uri, null, null);
                throw e;
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            ctx.getContentResolver().update(uri, values, null, null);
            return uri.toString();
        }

        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Dossier Téléchargements inaccessible");
        }
        File dest = new File(dir, safeName);
        try (FileInputStream in = new FileInputStream(source);
             java.io.FileOutputStream out = new java.io.FileOutputStream(dest)) {
            copy(in, out);
        }
        MediaScannerConnection.scanFile(
                ctx, new String[] { dest.getAbsolutePath() }, new String[] { mime }, null);
        return dest.getAbsolutePath();
    }

    private static File resolveSource(String sourcePath) {
        if (sourcePath == null || sourcePath.trim().isEmpty()) {
            throw new IllegalArgumentException("Fichier introuvable");
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

    private static void copy(FileInputStream in, OutputStream out) throws Exception {
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
        }
        out.flush();
    }
}
