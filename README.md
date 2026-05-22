# AgentifyAI

AgentifyAI is a Next.js learning workspace with Firebase Authentication, AI tutoring, autonomous missions, session replay, analytics, and a premium light/dark dashboard UI.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Firebase Auth Branding

Google sign-in displays the Firebase Auth domain in the account chooser. To avoid showing the internal Firebase project name, configure a branded auth domain in Firebase and set this env var in production:

```bash
NEXT_PUBLIC_FIREBASE_BRANDED_AUTH_DOMAIN=agentifyai.in
```

Keep `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` as the default Firebase fallback. The branded domain must be configured/authorized in Firebase Authentication before enabling it in production.
