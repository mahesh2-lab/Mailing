import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  plugins: [
    sentinelClient({
      identifyUrl: process.env.NEXT_PUBLIC_BETTER_AUTH_KV_URL,
      autoSolveChallenge: true, // Automatically solve PoW challenges
    }),
  ],
});
export const { signIn, signUp, useSession, signOut } = authClient;
