import { RequestHandler, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import { uploadBuffer } from '../services/storage';
import * as uploadService from '../services/uploadService';
import * as problemService from '../services/problemService';
import * as ascentService from '../services/ascentService';
import { visionQueue } from '../jobs/queue';

export const uploadsRouter = Router();

// ─── Multer setup ─────────────────────────────────────────────────────────────

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new AppError('INVALID_FILE_TYPE', 'Only JPEG and PNG images are accepted', 400));
    }
    cb(null, true);
  },
});

/** Wraps multer so its errors are converted to AppError before reaching the global handler. */
const parsePhotos: RequestHandler = (req, res, next) => {
  multerUpload.array('photos', 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === 'LIMIT_FILE_COUNT'
          ? 'Maximum 5 photos allowed'
          : err.code === 'LIMIT_FILE_SIZE'
            ? 'Each photo must be under 10 MB'
            : err.message;
      return next(new AppError('UPLOAD_ERROR', msg, 400));
    }
    if (err) return next(err as Error);
    next();
  });
};

// ─── Validation schemas ────────────────────────────────────────────────────────

const confirmBodySchema = z.object({
  problemId: z.union([z.literal('new'), z.string().uuid()]),
  user_grade: z.string().max(10).nullish().transform((v) => v ?? null),
  rating: z.number().int().min(1).max(5).nullish().transform((v) => v ?? null),
  notes: z.string().max(280).nullish().transform((v) => v ?? null),
  video_url: z.string().url().nullish().transform((v) => v ?? null),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
});

// ─── POST /uploads ─────────────────────────────────────────────────────────────

uploadsRouter.post('/', requireAuth, uploadLimiter, parsePhotos, async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length < 1) {
      throw new AppError('VALIDATION_ERROR', 'At least 1 photo is required', 400);
    }

    const bodySchema = z.object({
      colour: z.string().min(1),
      gym_id: z.string().uuid(),
    });
    const { colour, gym_id } = bodySchema.parse(req.body);

    const photoUrls = await Promise.all(
      files.map((f) => uploadBuffer(f.buffer, f.mimetype, 'problems')),
    );

    const uploadId = await uploadService.createUpload(
      req.user!.userId,
      gym_id,
      colour,
      photoUrls,
    );

    await visionQueue.add('process', {
      uploadId,
      userId: req.user!.userId,
      gymId: gym_id,
      colour,
      photoUrls,
    });

    res.status(201).json({ uploadId, status: 'pending' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /uploads/:uploadId/status ────────────────────────────────────────────

uploadsRouter.get('/:uploadId/status', requireAuth, async (req, res, next) => {
  try {
    const row = await uploadService.getUploadById(req.params['uploadId']!);

    if (row.user_id !== req.user!.userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    res.json({
      status: row.processing_status,
      similarityScore: row.similarity_score,
      matchedProblemId: row.problem_id,
      candidateProblems: [],
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /uploads/:uploadId/confirm ──────────────────────────────────────────

uploadsRouter.post('/:uploadId/confirm', requireAuth, async (req, res, next) => {
  try {
    const row = await uploadService.getUploadById(req.params['uploadId']!);

    if (row.user_id !== req.user!.userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }
    if (
      row.processing_status !== 'awaiting_confirmation' &&
      row.processing_status !== 'matched' &&
      row.processing_status !== 'unmatched'
    ) {
      throw new AppError('INVALID_STATE', 'Upload is not awaiting confirmation', 409);
    }

    const body = confirmBodySchema.parse(req.body);

    let problemId: string;
    if (body.problemId === 'new') {
      if (!row.gym_id || !row.colour) {
        throw new AppError('INTERNAL_ERROR', 'Upload is missing gym or colour', 500);
      }
      // Fall back to a random vector if the worker somehow didn't set one
      const holdVector = row.hold_vector ?? Array.from({ length: 20 }, () => Math.random());
      problemId = await problemService.createProblem(row.gym_id, row.colour, holdVector);
    } else {
      problemId = body.problemId;
    }

    await uploadService.updateUpload(row.id, {
      processing_status: 'complete',
      problem_id: problemId,
    });

    const ascentId = await ascentService.createAscent(req.user!.userId, problemId, {
      user_grade: body.user_grade,
      rating: body.rating,
      notes: body.notes,
      video_url: body.video_url,
      visibility: body.visibility,
    });

    await problemService.incrementTotalSends(problemId);
    await problemService.calculateConsensusGrade(problemId);

    res.status(201).json({ ascentId, problemId });
  } catch (err) {
    next(err);
  }
});

// ─── POST /uploads/:uploadId/dispute ──────────────────────────────────────────

uploadsRouter.post('/:uploadId/dispute', requireAuth, async (req, res, next) => {
  try {
    const { uploadId } = req.params;

    const { rows: uploadRows } = await pool.query<{
      id: string; problem_id: string | null;
    }>(
      `SELECT id, problem_id FROM uploads WHERE id = $1`,
      [uploadId],
    );
    const upload = uploadRows[0];
    if (!upload) throw new AppError('NOT_FOUND', 'Upload not found', 404);
    if (!upload.problem_id) {
      throw new AppError('INVALID_STATE', 'Upload has no matched problem to dispute', 409);
    }

    const { rows: existing } = await pool.query(
      `SELECT id FROM match_disputes WHERE upload_id = $1 AND status = 'open'`,
      [uploadId],
    );
    if (existing[0]) throw new AppError('CONFLICT', 'An open dispute already exists for this upload', 409);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO match_disputes (upload_id, reported_by, status)
       VALUES ($1, $2, 'open')
       RETURNING id`,
      [uploadId, req.user!.userId],
    );

    res.status(201).json({ disputeId: rows[0]!.id });
  } catch (err) {
    next(err);
  }
});
