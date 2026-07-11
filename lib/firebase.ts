import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirebasePublicConfig,
  getFirebasePublicEnvMessage,
  type FirebasePublicConfig,
} from "@/lib/env";

type FirebaseEnvSource = Record<string, string | undefined>;

let cachedAuth: Auth | null = null;
let cachedConfigSignature = "";

export class FirebaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigError";
  }
}

function getConfigSignature(config: FirebasePublicConfig) {
  return [
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.storageBucket,
    config.messagingSenderId,
    config.appId,
  ].join("|");
}

export function getFirebaseAuth(source: FirebaseEnvSource = process.env) {
  const config = getFirebasePublicConfig(source);

  if (!config) {
    throw new FirebaseConfigError(getFirebasePublicEnvMessage(source));
  }

  const signature = getConfigSignature(config);
  if (cachedAuth && cachedConfigSignature === signature) return cachedAuth;

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  cachedAuth = getAuth(app);
  cachedConfigSignature = signature;

  return cachedAuth;
}

export function getFirebaseAuthSetupMessage(source: FirebaseEnvSource = process.env) {
  return getFirebasePublicEnvMessage(source);
}

export function isFirebaseAuthConfigured(source: FirebaseEnvSource = process.env) {
  return getFirebasePublicEnvMessage(source) === "";
}

export function resetFirebaseAuthForTests() {
  cachedAuth = null;
  cachedConfigSignature = "";
}
