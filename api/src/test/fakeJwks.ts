/**
 * Test helpers for signing JWTs and mocking the Supabase JWKS endpoint.
 *
 * The real `auth.ts` calls `createRemoteJWKSet` from `jose`. We mock that
 * import so it returns a resolver keyed on our in-memory ES256 public key.
 */
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from 'jose';

export interface TestKeypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

let sharedKeypair: TestKeypair | null = null;

export async function generateTestKeypair(): Promise<TestKeypair> {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  sharedKeypair = {
    publicKey: publicKey as CryptoKey,
    privateKey: privateKey as CryptoKey,
  };
  return sharedKeypair;
}

export function getSharedKeypair(): TestKeypair {
  if (!sharedKeypair) {
    throw new Error('Test keypair not initialised — call generateTestKeypair() first');
  }
  return sharedKeypair;
}

export interface SignOptions {
  sub?: string;
  /** Unix timestamp (seconds). Defaults to now + 1h. */
  exp?: number;
  iss?: string;
  privateKey?: CryptoKey;
}

/** Sign an ES256 JWT for the test keypair. */
export async function signTestToken(options: SignOptions = {}): Promise<string> {
  const kp = options.privateKey
    ? { privateKey: options.privateKey, publicKey: getSharedKeypair().publicKey }
    : getSharedKeypair();

  const builder = new SignJWT({}).setProtectedHeader({ alg: 'ES256' }).setIssuedAt();

  if (options.sub !== undefined) {
    builder.setSubject(options.sub);
  }

  builder.setExpirationTime(options.exp ?? Math.floor(Date.now() / 1000) + 3600);

  if (options.iss) {
    builder.setIssuer(options.iss);
  }

  return builder.sign(kp.privateKey);
}

/**
 * Register a jest.mock for `jose`'s createRemoteJWKSet that returns the
 * in-memory test public key. Call BEFORE importing the middleware under test.
 *
 * Because the auth middleware imports both `createRemoteJWKSet` and `jwtVerify`
 * from `jose`, we mock only `createRemoteJWKSet` while letting `jwtVerify`
 * fall through to the real implementation. The mocked JWKS resolver returns
 * the test public key regardless of the `kid` header so we don't have to
 * match JWKS lookups precisely.
 */
export function installJwksMock(): void {
  jest.doMock('jose', () => {
    const actual = jest.requireActual('jose') as typeof import('jose');
    return {
      ...actual,
      createRemoteJWKSet: () => async () => getSharedKeypair().publicKey,
    };
  });
}

/** Convenience: JWK form of the public key (for tests inspecting JWKS shape). */
export async function exportPublicJwk(): Promise<Record<string, unknown>> {
  const jwk = await exportJWK(getSharedKeypair().publicKey);
  return jwk as unknown as Record<string, unknown>;
}
