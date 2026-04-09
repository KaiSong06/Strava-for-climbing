import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'json'],
  clearMocks: true,
  // Container cold starts need extra time; route tests wait for real Postgres/Redis.
  testTimeout: 120_000,
  // jose@6 ships ESM-only — transform it via ts-jest rather than excluding it.
  transformIgnorePatterns: ['/node_modules/(?!(jose|uuid)/)'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'commonjs',
          target: 'es2022',
          esModuleInterop: true,
          isolatedModules: true,
          allowJs: true,
        },
      },
    ],
  },
  // Scope coverage to the files under test in this sprint (security-critical
  // middleware + the route surface area that Initiative 2 covers). Other
  // routes (gyms, problems, search, pushTokens, users, auth, internal, health)
  // are out of scope for this sprint and will be covered by later sprints.
  collectCoverageFrom: [
    'src/lib/cursorPagination.ts',
    'src/middleware/auth.ts',
    'src/middleware/errorHandler.ts',
    'src/middleware/rateLimiter.ts',
    'src/routes/uploads.ts',
    'src/routes/ascents.ts',
    'src/routes/follows.ts',
    'src/routes/feed.ts',
    'src/routes/disputes.ts',
    'src/services/ascentService.ts',
    'src/services/feedService.ts',
    'src/services/friendsService.ts',
    'src/services/gymService.ts',
    'src/services/problemService.ts',
    'src/services/pushService.ts',
    'src/services/uploadService.ts',
    'src/services/userService.ts',
    'src/services/storage.ts',
    'src/services/geocodeService.ts',
    'src/jobs/visionWorker.ts',
  ],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
};

export default config;
