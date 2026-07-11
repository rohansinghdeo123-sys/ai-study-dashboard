import { describe, expect, it } from "vitest";
import {
  assertFirebasePublicEnv,
  formatFirebasePublicEnvError,
  getFirebasePublicConfig,
  getMissingFirebasePublicEnv,
  getPublicBackendUrl,
} from "@/lib/env";

const validFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "agentifyai.test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "agentifyai-test",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "agentifyai-test.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:test",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-TEST123",
};

describe("public environment validation", () => {
  it("returns a typed Firebase public config when required values exist", () => {
    expect(getFirebasePublicConfig(validFirebaseEnv)).toEqual({
      apiKey: "test-api-key",
      authDomain: "agentifyai.test.firebaseapp.com",
      projectId: "agentifyai-test",
      storageBucket: "agentifyai-test.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:test",
      measurementId: "G-TEST123",
    });
  });

  it("allows the branded auth domain to override the Firebase default domain", () => {
    expect(
      getFirebasePublicConfig({
        ...validFirebaseEnv,
        NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN: "login.agentifyai.test",
      })?.authDomain,
    ).toBe("login.agentifyai.test");
  });

  it("reports every missing required Firebase public value clearly", () => {
    const missing = getMissingFirebasePublicEnv({});

    expect(missing).toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
    expect(missing).toContain(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN or NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN",
    );
    expect(formatFirebasePublicEnvError(missing)).toContain(
      "Firebase auth configuration is incomplete.",
    );
  });

  it("throws a predictable production-build validation error", () => {
    expect(() => assertFirebasePublicEnv({})).toThrow(
      /Missing public environment variables:/,
    );
  });

  it("uses the local backend URL only as an explicit fallback", () => {
    expect(getPublicBackendUrl({})).toBe("http://127.0.0.1:8000");
    expect(getPublicBackendUrl({ NEXT_PUBLIC_BACKEND_URL: " https://api.test " })).toBe(
      "https://api.test",
    );
  });
});
