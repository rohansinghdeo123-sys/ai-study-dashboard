type PublicEnvSource = Record<string, string | undefined>;

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

const REQUIRED_FIREBASE_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const AUTH_DOMAIN_ENV = [
  "NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
] as const;

const INLINE_PUBLIC_ENV: PublicEnvSource = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
};

export type RequiredFirebaseEnvKey =
  | (typeof REQUIRED_FIREBASE_ENV)[number]
  | "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN or NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN";

function readPublicEnv(source: PublicEnvSource, key: string) {
  return source[key]?.trim() || "";
}

export function getMissingFirebasePublicEnv(
  source: PublicEnvSource = INLINE_PUBLIC_ENV,
): RequiredFirebaseEnvKey[] {
  const missing = REQUIRED_FIREBASE_ENV.filter((key) => !readPublicEnv(source, key));
  const hasAuthDomain = AUTH_DOMAIN_ENV.some((key) => readPublicEnv(source, key));

  return [
    ...missing,
    ...(hasAuthDomain
      ? []
      : [
          "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN or NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN" as const,
        ]),
  ];
}

export function formatFirebasePublicEnvError(
  missing: readonly RequiredFirebaseEnvKey[],
) {
  return [
    "Firebase auth configuration is incomplete.",
    `Missing public environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
    "These values are public Firebase web-app identifiers, not service-account secrets.",
  ].join(" ");
}

export function assertFirebasePublicEnv(source: PublicEnvSource = INLINE_PUBLIC_ENV) {
  const missing = getMissingFirebasePublicEnv(source);
  if (missing.length > 0) {
    throw new Error(formatFirebasePublicEnvError(missing));
  }
}

export function getFirebasePublicConfig(
  source: PublicEnvSource = INLINE_PUBLIC_ENV,
): FirebasePublicConfig | null {
  const missing = getMissingFirebasePublicEnv(source);
  if (missing.length > 0) return null;

  const authDomain =
    readPublicEnv(source, "NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN") ||
    readPublicEnv(source, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");

  return {
    apiKey: readPublicEnv(source, "NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain,
    projectId: readPublicEnv(source, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: readPublicEnv(source, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readPublicEnv(
      source,
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    ),
    appId: readPublicEnv(source, "NEXT_PUBLIC_FIREBASE_APP_ID"),
    measurementId: readPublicEnv(source, "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID") || undefined,
  };
}

export function getFirebasePublicEnvMessage(source: PublicEnvSource = INLINE_PUBLIC_ENV) {
  const missing = getMissingFirebasePublicEnv(source);
  return missing.length > 0 ? formatFirebasePublicEnvError(missing) : "";
}

export function getPublicBackendUrl(source: PublicEnvSource = INLINE_PUBLIC_ENV) {
  return readPublicEnv(source, "NEXT_PUBLIC_BACKEND_URL") || "http://127.0.0.1:8000";
}
