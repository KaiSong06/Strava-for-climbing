/**
 * OpenAPI 3.1 spec builder — single source of truth for the generated
 * `docs/openapi.json` reference.
 *
 * This file is imported ONLY from the `scripts/generateOpenApi.ts` build
 * script. It is NEVER imported from a route, middleware, or service. That
 * keeps the `@asteasolutions/zod-to-openapi` side-effect (it extends the
 * Zod prototype with an `.openapi()` method) scoped to the build-time
 * generator and out of the request-handling path.
 *
 * The schemas declared here are documentation-only: they mirror the
 * runtime Zod schemas inside each route file. Keeping them as a dedicated
 * registry decouples the docs build from the route wiring — routes can
 * evolve without dragging an openapi import in, and the docs build can
 * diverge intentionally (e.g. to expose a richer response schema than the
 * minimum the route validates).
 *
 * When a route changes, update the matching schema/path registration
 * below and re-run `npm run docs:openapi`. The script writes
 * `docs/openapi.json` at the repo root.
 */
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

// ─── Shared primitives ────────────────────────────────────────────────────────

const UuidSchema = z.string().uuid().openapi({ example: '11111111-0000-0000-0000-000000000001' });

const IsoTimestampSchema = z
  .string()
  .datetime()
  .openapi({ example: '2026-04-09T12:34:56.000Z' });

const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({ example: 'At least 1 photo is required' }),
    }),
  })
  .openapi('ApiError');

const PaginationEnvelope = <T extends z.ZodTypeAny>(itemSchema: T): z.ZodTypeAny =>
  z.object({
    data: z.array(itemSchema),
    cursor: z.string().nullable(),
    has_more: z.boolean(),
  });

const CursorQuerySchema = z.object({
  cursor: z.string().optional().openapi({ description: 'Opaque base64url cursor from a prior response' }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .openapi({ description: 'Page size (1–50)' }),
});

// ─── Domain primitives (mirrors of shared/types.ts) ──────────────────────────

const AscentVisibilityEnum = z.enum(['public', 'friends', 'private']);
const AscentTypeEnum = z.enum(['flash', 'send', 'attempt']);
const ProcessingStatusEnum = z.enum([
  'pending',
  'processing',
  'awaiting_confirmation',
  'complete',
  'matched',
  'unmatched',
  'failed',
]);
const DisputeStatusEnum = z.enum(['open', 'resolved_confirm', 'resolved_split']);

const UserProfileSchema = z
  .object({
    id: UuidSchema,
    username: z.string(),
    display_name: z.string(),
    avatar_url: z.string().nullable(),
    home_gym_id: UuidSchema.nullable(),
    username_changed_at: IsoTimestampSchema.nullable(),
    default_visibility: AscentVisibilityEnum,
    created_at: IsoTimestampSchema,
    home_gym_name: z.string().nullable(),
    follower_count: z.number().int(),
    following_count: z.number().int(),
  })
  .openapi('UserProfile');

const AuthUserSchema = UserProfileSchema.extend({ phone: z.string() }).openapi('AuthUser');

const GymSchema = z
  .object({
    id: UuidSchema,
    name: z.string(),
    city: z.string(),
    lat: z.number(),
    lng: z.number(),
    default_retirement_days: z.number().int(),
    created_at: IsoTimestampSchema,
  })
  .openapi('Gym');

const NearbyGymSchema = GymSchema.extend({ distance_km: z.number() }).openapi('NearbyGym');

const ProblemSchema = z
  .object({
    id: UuidSchema,
    gym_id: UuidSchema,
    colour: z.string(),
    hold_vector: z.array(z.number()).nullable(),
    model_url: z.string().nullable(),
    status: z.enum(['active', 'retired']),
    consensus_grade: z.string().nullable(),
    total_sends: z.number().int(),
    first_upload_at: IsoTimestampSchema,
    retired_at: IsoTimestampSchema.nullable(),
    created_at: IsoTimestampSchema,
  })
  .openapi('Problem');

const FeedItemSchema = z
  .object({
    id: UuidSchema,
    logged_at: IsoTimestampSchema,
    type: AscentTypeEnum,
    user: z.object({
      id: UuidSchema,
      username: z.string(),
      display_name: z.string(),
      avatar_url: z.string().nullable(),
    }),
    problem: z.object({
      id: UuidSchema,
      colour: z.string(),
      consensus_grade: z.string().nullable(),
      gym: z.object({ id: UuidSchema, name: z.string() }),
    }),
    user_grade: z.string().nullable(),
    rating: z.number().int().min(1).max(5).nullable(),
    notes: z.string().nullable(),
    photo_urls: z.array(z.string()),
  })
  .openapi('FeedItem');

// ─── Registry ─────────────────────────────────────────────────────────────────

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Supabase Auth ES256 JWT. Verified via JWKS fetched from {SUPABASE_URL}/auth/v1/.well-known/jwks.json.',
  });
  registry.registerComponent('securitySchemes', 'InternalSecret', {
    type: 'apiKey',
    in: 'header',
    name: 'X-Internal-Secret',
    description: 'Shared secret for the /internal routes. Used by external cron triggers.',
  });

  // Health
  registry.registerPath({
    method: 'get',
    path: '/health',
    summary: 'Liveness probe (also checks Postgres reachability)',
    tags: ['health'],
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('ok'), db: z.enum(['connected', 'disconnected']) }),
          },
        },
      },
    },
  });

  // Auth
  registry.registerPath({
    method: 'post',
    path: '/auth/delete-account',
    summary: 'Permanently delete the authenticated user (Supabase + public.users)',
    description: 'Rate limited by authLimiter (10/min).',
    tags: ['auth'],
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'Deleted',
        content: { 'application/json': { schema: z.object({ message: z.string() }) } },
      },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  // Users
  registry.registerPath({
    method: 'get',
    path: '/users/me',
    summary: 'Fetch the authenticated user profile (includes phone)',
    tags: ['users'],
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: AuthUserSchema } },
      },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/users/me',
    summary: 'Update the authenticated user profile',
    tags: ['users'],
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/).optional(),
              display_name: z.string().min(1).max(50).optional(),
              home_gym_id: UuidSchema.nullable().optional(),
              avatar_base64: z.string().optional(),
              default_visibility: AscentVisibilityEnum.optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: UserProfileSchema } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/{username}',
    summary: 'Public profile lookup by username',
    tags: ['users'],
    request: { params: z.object({ username: z.string() }) },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: UserProfileSchema } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/{username}/ascents',
    summary: 'Paginated ascents (visibility depends on viewer)',
    tags: ['users'],
    request: {
      params: z.object({ username: z.string() }),
      query: CursorQuerySchema,
    },
    responses: {
      200: {
        description: 'OK',
        content: { 'application/json': { schema: PaginationEnvelope(FeedItemSchema) } },
      },
    },
  });

  // Follows (mounted at /users)
  registry.registerPath({
    method: 'get',
    path: '/users/me/friends',
    summary: 'Users the authenticated user follows, ordered by recent activity',
    tags: ['follows'],
    security: [{ BearerAuth: [] }],
    request: {
      query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }),
    },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ data: z.array(UserProfileSchema) }) } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/users/{username}/follow',
    summary: 'Follow a user',
    tags: ['follows'],
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ username: z.string() }) },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: z.object({ following: z.literal(true) }) } } },
      409: { description: 'Already following', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/users/{username}/follow',
    summary: 'Unfollow a user',
    tags: ['follows'],
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ username: z.string() }) },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ following: z.literal(false) }) } } },
      404: { description: 'Not following', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/users/{username}/followers',
    summary: 'Paginated followers list (keyset)',
    tags: ['follows'],
    request: { params: z.object({ username: z.string() }), query: CursorQuerySchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: PaginationEnvelope(UserProfileSchema) } } },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/users/{username}/following',
    summary: 'Paginated following list (keyset)',
    tags: ['follows'],
    request: { params: z.object({ username: z.string() }), query: CursorQuerySchema },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: PaginationEnvelope(UserProfileSchema) } } },
    },
  });

  // Gyms
  registry.registerPath({
    method: 'get',
    path: '/gyms',
    summary: 'List all gyms',
    tags: ['gyms'],
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ data: z.array(GymSchema) }) } } } },
  });
  registry.registerPath({
    method: 'get',
    path: '/gyms/geocode',
    summary: 'Geocode a free-text address to lat/lng',
    tags: ['gyms'],
    request: { query: z.object({ address: z.string().min(2) }) },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ data: z.object({ lat: z.number(), lng: z.number(), formatted_address: z.string() }) } ) } } },
      404: { description: 'No results', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/gyms/nearby',
    summary: 'Gyms within `radius` km of a point',
    tags: ['gyms'],
    request: {
      query: z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
        radius: z.coerce.number().min(1).max(200).default(50),
        limit: z.coerce.number().int().min(1).max(50).default(10),
      }),
    },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ data: z.array(NearbyGymSchema) }) } } } },
  });
  registry.registerPath({
    method: 'get',
    path: '/gyms/{gymId}',
    summary: 'Gym detail + aggregate stats',
    tags: ['gyms'],
    request: { params: z.object({ gymId: UuidSchema }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ gym: GymSchema }) } } } },
  });
  registry.registerPath({
    method: 'get',
    path: '/gyms/{gymId}/problems',
    summary: 'Gym problems (active/retired/all), keyset paginated',
    tags: ['gyms'],
    request: {
      params: z.object({ gymId: UuidSchema }),
      query: z.object({
        status: z.enum(['active', 'retired', 'all']).default('active'),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
    },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: PaginationEnvelope(ProblemSchema) } } } },
  });
  registry.registerPath({
    method: 'get',
    path: '/gyms/{gymId}/problems/retired',
    summary: 'Retired problems grouped by retirement month',
    tags: ['gyms'],
    request: { params: z.object({ gymId: UuidSchema }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ data: z.array(z.object({ month: z.string(), problems: z.array(ProblemSchema) })) }) } } } },
  });

  // Feed
  registry.registerPath({
    method: 'get',
    path: '/feed',
    summary: 'Personal feed — ascents from users you follow',
    description: 'Uses keyset pagination on (logged_at DESC, id DESC). See ADR 0004.',
    tags: ['feed'],
    security: [{ BearerAuth: [] }],
    request: { query: CursorQuerySchema },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: PaginationEnvelope(FeedItemSchema) } } } },
  });
  registry.registerPath({
    method: 'get',
    path: '/feed/discover',
    summary: 'Discovery feed — recent public ascents',
    tags: ['feed'],
    request: { query: CursorQuerySchema },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: PaginationEnvelope(FeedItemSchema) } } } },
  });
  registry.registerPath({
    method: 'get',
    path: '/feed/gym/{gymId}',
    summary: 'Recent public ascents at a specific gym',
    tags: ['feed'],
    request: { params: z.object({ gymId: UuidSchema }), query: CursorQuerySchema },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: PaginationEnvelope(FeedItemSchema) } } } },
  });

  // Uploads
  registry.registerPath({
    method: 'post',
    path: '/uploads',
    summary: 'Submit photos for vision processing',
    description:
      'Multipart body with one or more photo files. Enqueues a BullMQ vision job; see ADR 0005 for the async contract. Rate limited by uploadLimiter (20/min).',
    tags: ['uploads'],
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              colour: z.string(),
              gym_id: UuidSchema,
              photos: z.array(z.string()).openapi({ format: 'binary', description: '1+ image files' }),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Accepted; poll /uploads/{id}/status', content: { 'application/json': { schema: z.object({ uploadId: UuidSchema, status: z.literal('pending') }) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
      429: { description: 'Rate limited', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/uploads/{uploadId}/status',
    summary: 'Poll vision pipeline state for an upload',
    tags: ['uploads'],
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ uploadId: UuidSchema }) },
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: z.object({
              status: ProcessingStatusEnum,
              similarityScore: z.number().nullable(),
              matchedProblemId: UuidSchema.nullable(),
              modelUrl: z.string().nullable(),
              candidateProblems: z.array(ProblemSchema),
            }),
          },
        },
      },
      403: { description: 'Upload belongs to another user', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/uploads/{uploadId}/confirm',
    summary: 'Confirm the match (or create a new problem) and log an ascent',
    tags: ['uploads'],
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ uploadId: UuidSchema }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              problemId: z.union([z.literal('new'), UuidSchema]),
              user_grade: z.string().max(10).nullable().optional(),
              rating: z.number().int().min(1).max(5).nullable().optional(),
              notes: z.string().max(280).nullable().optional(),
              video_url: z.string().url().nullable().optional(),
              visibility: AscentVisibilityEnum.default('public'),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Confirmed', content: { 'application/json': { schema: z.object({ ascentId: UuidSchema, problemId: UuidSchema }) } } },
      409: { description: 'Upload not in a confirmable state', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/uploads/{uploadId}/dispute',
    summary: 'Open a match dispute on a matched upload',
    tags: ['uploads'],
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ uploadId: UuidSchema }) },
    responses: {
      201: { description: 'Opened', content: { 'application/json': { schema: z.object({ disputeId: UuidSchema }) } } },
      409: { description: 'No matched problem, or open dispute already exists', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  // Ascents
  registry.registerPath({
    method: 'get',
    path: '/ascents/{ascentId}',
    summary: 'Ascent detail with joined problem and gym',
    tags: ['ascents'],
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ ascentId: UuidSchema }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: FeedItemSchema } } } },
  });
  registry.registerPath({
    method: 'post',
    path: '/ascents',
    summary: 'Log an ascent directly on a known problem (skips the upload flow)',
    tags: ['ascents'],
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              problem_id: UuidSchema,
              user_grade: z.string().max(10).nullable().optional(),
              rating: z.number().int().min(1).max(5).nullable().optional(),
              notes: z.string().max(280).nullable().optional(),
              visibility: AscentVisibilityEnum.default('public'),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: z.object({ ascentId: UuidSchema, problemId: UuidSchema }) } } },
      404: { description: 'Problem not found', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  // Problems
  registry.registerPath({
    method: 'get',
    path: '/problems/{problemId}',
    summary: 'Problem detail + ascent summary + grade distribution',
    tags: ['problems'],
    request: { params: z.object({ problemId: UuidSchema }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ problem: ProblemSchema }) } } } },
  });
  registry.registerPath({
    method: 'get',
    path: '/problems/{problemId}/ascents',
    summary: 'Paginated ascents on a problem (visibility-filtered)',
    tags: ['problems'],
    request: {
      params: z.object({ problemId: UuidSchema }),
      query: CursorQuerySchema,
    },
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: PaginationEnvelope(
              z.object({
                id: UuidSchema,
                type: AscentTypeEnum,
                user_grade: z.string().nullable(),
                rating: z.number().int().nullable(),
                notes: z.string().nullable(),
                logged_at: IsoTimestampSchema,
                user: z.object({
                  id: UuidSchema,
                  username: z.string(),
                  display_name: z.string(),
                  avatar_url: z.string().nullable(),
                }),
              }),
            ),
          },
        },
      },
    },
  });

  // Disputes
  registry.registerPath({
    method: 'post',
    path: '/disputes/{disputeId}/vote',
    summary: 'Vote on an open match dispute (requires ascent on disputed problem)',
    tags: ['disputes'],
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ disputeId: UuidSchema }),
      body: { content: { 'application/json': { schema: z.object({ vote: z.enum(['confirm', 'split']) }) } } },
    },
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: z.object({
              disputeId: UuidSchema,
              status: DisputeStatusEnum.or(z.literal('open')),
              votes_confirm: z.number().int(),
              votes_split: z.number().int(),
            }),
          },
        },
      },
      403: { description: 'Voter has no ascent on the disputed problem', content: { 'application/json': { schema: ErrorSchema } } },
      409: { description: 'Dispute already resolved', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  // Search
  registry.registerPath({
    method: 'get',
    path: '/search',
    summary: 'Search users and/or gyms by substring (min 2 chars)',
    tags: ['search'],
    request: {
      query: z.object({
        q: z.string().min(2),
        type: z.enum(['user', 'gym', 'all']).default('all'),
      }),
    },
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: z.object({
              query: z.string(),
              data: z.array(
                z.union([
                  z.object({ type: z.literal('user'), id: UuidSchema, username: z.string(), display_name: z.string(), avatar_url: z.string().nullable() }),
                  z.object({ type: z.literal('gym'), id: UuidSchema, name: z.string(), city: z.string() }),
                ]),
              ),
            }),
          },
        },
      },
    },
  });

  // Push tokens
  registry.registerPath({
    method: 'post',
    path: '/push-tokens',
    summary: 'Register an Expo push token for the authenticated user',
    tags: ['push-tokens'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: z.object({ token: z.string() }) } } } },
    responses: { 201: { description: 'Registered', content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } } } },
  });
  registry.registerPath({
    method: 'delete',
    path: '/push-tokens',
    summary: 'Remove an Expo push token',
    tags: ['push-tokens'],
    security: [{ BearerAuth: [] }],
    request: { query: z.object({ token: z.string() }) },
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ ok: z.literal(true) }) } } } },
  });

  // Internal
  registry.registerPath({
    method: 'post',
    path: '/internal/run-retirement',
    summary: 'Trigger the nightly retirement sweep (cron entry point)',
    tags: ['internal'],
    security: [{ InternalSecret: [] }],
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.object({ retired: z.number().int() }) } } },
      403: { description: 'Invalid or missing X-Internal-Secret', content: { 'application/json': { schema: ErrorSchema } } },
    },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Crux API',
      version: '0.1.0',
      description:
        'REST API for Crux ("Strava for bouldering"). Generated from Zod schemas via @asteasolutions/zod-to-openapi. See docs/adr/ for architectural decisions.',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local development' },
    ],
    tags: [
      { name: 'health' },
      { name: 'auth' },
      { name: 'users' },
      { name: 'follows' },
      { name: 'gyms' },
      { name: 'feed' },
      { name: 'uploads' },
      { name: 'ascents' },
      { name: 'problems' },
      { name: 'disputes' },
      { name: 'search' },
      { name: 'push-tokens' },
      { name: 'internal' },
    ],
  });
}
