import { createAuthClient } from "better-auth/react";
import { dashClient, sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  plugins: [
    dashClient(),
    sentinelClient({
      autoSolveChallenge: true, // Automatically solve PoW challenges
    }),
  ],
});
export const { signIn, signUp, useSession, signOut } = authClient;
