"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type ConfirmationResult,
  type User,
  GoogleAuthProvider,
  RecaptchaVerifier,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  apiJson,
  invalidateApiCache,
  primeBackend,
} from "@/lib/apiClient";
import {
  type BackendUserProfile,
  type ProfileUpdate,
  resolveDisplayName,
} from "@/lib/profile";

type AuthRole = "admin" | "user";

type AuthProfile = {
  uid: string;
  role: AuthRole;
  name: string;
  email: string;
  phone: string;
  photoURL: string;
  provider: string;
  classLevel: string;
  onboardingCompleted: boolean;
};

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  accountProfile: BackendUserProfile | null;
  userId: string;
  role: AuthRole;
  isAdmin: boolean;
  loading: boolean;
  claimsLoading: boolean;
  claims: Record<string, unknown>;
  profileError: string;
  loginWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phoneNumber: string) => Promise<void>;
  verifyPhoneOtp: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshClaims: (forceRefresh?: boolean) => Promise<void>;
  refreshProfile: () => Promise<BackendUserProfile | null>;
  saveProfile: (updates: ProfileUpdate) => Promise<BackendUserProfile>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  getAuthHeaders: () => Promise<HeadersInit>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  accountProfile: null,
  userId: "",
  role: "user",
  isAdmin: false,
  loading: true,
  claimsLoading: true,
  claims: {},
  profileError: "",
  loginWithGoogle: async () => {},
  sendPhoneOtp: async () => {},
  verifyPhoneOtp: async () => {},
  logout: async () => {},
  refreshClaims: async () => {},
  refreshProfile: async () => null,
  saveProfile: async () => {
    throw new Error("No authenticated user.");
  },
  getIdToken: async () => null,
  getAuthHeaders: async () => ({ "Content-Type": "application/json" }),
});

function parseEnvList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getRecaptchaContainer() {
  const container = document.getElementById("recaptcha-container");

  if (!container) {
    throw new Error(
      'Missing recaptcha container. Add <div id="recaptcha-container" /> to the login page.',
    );
  }

  return container;
}

function getProvider(user: User | null) {
  return user?.providerData?.[0]?.providerId ?? "unknown";
}

function hasAdminClaim(claims: Record<string, unknown>) {
  if (claims.admin === true) return true;
  if (claims.role === "admin") return true;

  const roles = claims.roles;
  return Array.isArray(roles) && roles.includes("admin");
}

function isAdminUser(user: User | null, claims: Record<string, unknown>) {
  if (!user) return false;
  if (hasAdminClaim(claims)) return true;

  const adminEmails = parseEnvList(process.env.NEXT_PUBLIC_ADMIN_EMAILS);
  const adminUids = parseEnvList(process.env.NEXT_PUBLIC_ADMIN_UIDS);
  const adminPhones = parseEnvList(process.env.NEXT_PUBLIC_ADMIN_PHONES);

  const email = user.email?.toLowerCase() ?? "";
  const uid = user.uid.toLowerCase();
  const phone = user.phoneNumber?.toLowerCase() ?? "";

  return (
    adminEmails.includes(email) ||
    adminUids.includes(uid) ||
    adminPhones.includes(phone)
  );
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function getFirebaseErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }

  return error instanceof Error ? error.message : String(error);
}

function shouldUseRedirectFallback(error: unknown) {
  const code = getFirebaseErrorCode(error);

  return [
    "auth/popup-blocked",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ].some((fallbackCode) => code.includes(fallbackCode));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [accountProfile, setAccountProfile] = useState<BackendUserProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claims, setClaims] = useState<Record<string, unknown>>({});

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const loadProfile = useCallback(
    async (currentUser: User, forceFresh = false) => {
      setProfileLoading(true);
      setProfileError("");
      try {
        primeBackend(backendURL);
        const token = await currentUser.getIdToken();
        const loadedProfile = await apiJson<BackendUserProfile>(
          `${backendURL}/profile/me`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            cacheKey: `account-profile:${currentUser.uid}`,
            cacheTtlMs: 30000,
            forceFresh,
            retries: 2,
            timeoutMs: 12000,
          },
        );
        setAccountProfile(loadedProfile);
        return loadedProfile;
      } catch (error) {
        setAccountProfile(null);
        setProfileError(
          error instanceof Error
            ? error.message
            : "We could not load your AgentifyAI profile.",
        );
        return null;
      } finally {
        setProfileLoading(false);
      }
    },
    [backendURL],
  );

  const refreshClaims = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) {
      setClaims({});
      setClaimsLoading(false);
      return;
    }

    setClaimsLoading(true);

    try {
      const tokenResult = await auth.currentUser.getIdTokenResult(forceRefresh);
      setClaims(tokenResult.claims as Record<string, unknown>);
    } finally {
      setClaimsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, createGoogleProvider());
    } catch (error) {
      if (shouldUseRedirectFallback(error)) {
        await signInWithRedirect(auth, createGoogleProvider());
        return;
      }

      throw error;
    }
  }, []);

  const getRecaptchaVerifier = useCallback(async () => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        auth,
        getRecaptchaContainer(),
        { size: "invisible" },
      );

      await recaptchaVerifierRef.current.render();
    }

    return recaptchaVerifierRef.current;
  }, []);

  const resetRecaptcha = useCallback(() => {
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
  }, []);

  const sendPhoneOtp = useCallback(
    async (phoneNumber: string) => {
      try {
        const normalizedPhone = phoneNumber.trim();
        const appVerifier = await getRecaptchaVerifier();

        confirmationResultRef.current = await signInWithPhoneNumber(
          auth,
          normalizedPhone,
          appVerifier,
        );
      } catch (error) {
        resetRecaptcha();
        throw error;
      }
    },
    [getRecaptchaVerifier, resetRecaptcha],
  );

  const verifyPhoneOtp = useCallback(async (otp: string) => {
    if (!confirmationResultRef.current) {
      throw new Error("OTP was not requested. Please send OTP again.");
    }

    await confirmationResultRef.current.confirm(otp.trim());
    confirmationResultRef.current = null;
  }, []);

  const logout = useCallback(async () => {
    confirmationResultRef.current = null;
    resetRecaptcha();
    setAccountProfile(null);
    setProfileError("");
    await signOut(auth);
  }, [resetRecaptcha]);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const token = await getIdToken();

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [getIdToken]);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setAccountProfile(null);
      return null;
    }
    invalidateApiCache(`account-profile:${auth.currentUser.uid}`);
    return loadProfile(auth.currentUser, true);
  }, [loadProfile]);

  const saveProfile = useCallback(
    async (updates: ProfileUpdate) => {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Your session has expired. Please sign in again.");

      setProfileError("");
      const token = await currentUser.getIdToken();
      const updatedProfile = await apiJson<BackendUserProfile>(
        `${backendURL}/profile/me`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
          forceFresh: true,
          retries: 2,
          timeoutMs: 12000,
        },
      );
      invalidateApiCache(`account-profile:${currentUser.uid}`);
      setAccountProfile(updatedProfile);
      return updatedProfile;
    },
    [backendURL],
  );

  useEffect(() => {
    getRedirectResult(auth).catch(() => undefined);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setAccountProfile(null);
        setProfileError("");
        setProfileLoading(false);
        setClaims({});
        setClaimsLoading(false);
        return;
      }

      primeBackend(process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000");
      await Promise.all([refreshClaims(), loadProfile(currentUser)]);
    });

    return () => unsubscribe();
  }, [loadProfile, refreshClaims]);

  const isAdmin = useMemo(() => isAdminUser(user, claims), [user, claims]);
  const role: AuthRole = isAdmin ? "admin" : "user";
  const loading = authLoading || profileLoading;

  const profile = useMemo<AuthProfile | null>(() => {
    if (!user) return null;

    return {
      uid: user.uid,
      role,
      name: resolveDisplayName(accountProfile, user),
      email: user.email ?? "",
      phone: user.phoneNumber ?? "",
      photoURL: user.photoURL ?? "",
      provider: getProvider(user),
      classLevel: accountProfile?.class_level || "",
      onboardingCompleted: Boolean(accountProfile?.onboarding_completed),
    };
  }, [accountProfile, role, user]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      accountProfile,
      userId: user?.uid ?? "",
      role,
      isAdmin,
      loading,
      claimsLoading,
      claims,
      profileError,
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      logout,
      refreshClaims,
      refreshProfile,
      saveProfile,
      getIdToken,
      getAuthHeaders,
    }),
    [
      user,
      profile,
      accountProfile,
      role,
      isAdmin,
      loading,
      claimsLoading,
      claims,
      profileError,
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      logout,
      refreshClaims,
      refreshProfile,
      saveProfile,
      getIdToken,
      getAuthHeaders,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
