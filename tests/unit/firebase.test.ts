import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMock = vi.hoisted(() => {
  const state = {
    apps: [] as Array<{ name: string; options: unknown }>,
  };

  return {
    state,
    getApps: vi.fn(() => state.apps),
    getApp: vi.fn(() => state.apps[0]),
    initializeApp: vi.fn((options: unknown) => {
      const app = { name: "[DEFAULT]", options };
      state.apps.push(app);
      return app;
    }),
    getAuth: vi.fn((app: unknown) => ({ app })),
  };
});

vi.mock("firebase/app", () => ({
  getApps: firebaseMock.getApps,
  getApp: firebaseMock.getApp,
  initializeApp: firebaseMock.initializeApp,
}));

vi.mock("firebase/auth", () => ({
  getAuth: firebaseMock.getAuth,
}));

import {
  FirebaseConfigError,
  getFirebaseAuth,
  resetFirebaseAuthForTests,
} from "@/lib/firebase";

const validFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "agentifyai.test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "agentifyai-test",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "agentifyai-test.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:test",
};

describe("Firebase auth initialization", () => {
  beforeEach(() => {
    firebaseMock.state.apps.length = 0;
    vi.clearAllMocks();
    resetFirebaseAuthForTests();
  });

  it("does not initialize Firebase when public configuration is missing", () => {
    expect(() => getFirebaseAuth({})).toThrow(FirebaseConfigError);
    expect(firebaseMock.initializeApp).not.toHaveBeenCalled();
    expect(firebaseMock.getAuth).not.toHaveBeenCalled();
  });

  it("initializes Firebase lazily with validated public config", () => {
    const auth = getFirebaseAuth(validFirebaseEnv);

    expect(auth).toEqual({
      app: {
        name: "[DEFAULT]",
        options: expect.objectContaining({
          apiKey: "test-api-key",
          authDomain: "agentifyai.test.firebaseapp.com",
        }),
      },
    });
    expect(firebaseMock.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseMock.getAuth).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached auth instance for the same config", () => {
    const first = getFirebaseAuth(validFirebaseEnv);
    const second = getFirebaseAuth(validFirebaseEnv);

    expect(second).toBe(first);
    expect(firebaseMock.initializeApp).toHaveBeenCalledTimes(1);
    expect(firebaseMock.getAuth).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing default app instead of creating a duplicate app", () => {
    firebaseMock.state.apps.push({
      name: "[DEFAULT]",
      options: { projectId: "existing" },
    });

    getFirebaseAuth(validFirebaseEnv);

    expect(firebaseMock.getApp).toHaveBeenCalledTimes(1);
    expect(firebaseMock.initializeApp).not.toHaveBeenCalled();
    expect(firebaseMock.getAuth).toHaveBeenCalledTimes(1);
  });
});
