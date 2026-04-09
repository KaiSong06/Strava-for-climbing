import { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from './errorHandler';

/**
 * Multipart/form-data parsing for photo uploads.
 *
 * Accepts up to 5 JPEG/PNG files (max 10 MB each) under the `photos` field.
 * Files are kept in memory because downstream code streams the buffer straight
 * to object storage — we never write to disk.
 *
 * Extracted from `routes/uploads.ts` so the route file stays focused on HTTP
 * concerns and the middleware can be composed into any future upload route.
 */

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
const FIELD_NAME = 'photos';

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new AppError('INVALID_FILE_TYPE', 'Only JPEG and PNG images are accepted', 400));
    }
    cb(null, true);
  },
});

/**
 * Wraps multer so its errors are normalized to `AppError` before reaching the
 * global error handler. Converts the two most common multer error codes to
 * user-friendly messages; everything else is forwarded as-is.
 */
export const parsePhotos: RequestHandler = (req, res, next) => {
  multerUpload.array(FIELD_NAME, MAX_FILES)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_COUNT'
          ? `Maximum ${MAX_FILES} photos allowed`
          : err.code === 'LIMIT_FILE_SIZE'
            ? `Each photo must be under ${MAX_FILE_BYTES / (1024 * 1024)} MB`
            : err.message;
      return next(new AppError('UPLOAD_ERROR', message, 400));
    }
    if (err) return next(err as Error);
    next();
  });
};
