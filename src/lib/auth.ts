import { betterAuth } from "better-auth";
import { dash, sentinel } from "@better-auth/infra";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "../index";
import * as authSchema from "../db/auth-schema";
import { userSettings } from "../db/schema";
import { getResendClient } from "@/lib/resend";

export const auth = betterAuth({
  appName: "Mailing",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema, 
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      after(async () => {
        try {
          const [resend, settings] = await Promise.all([
            getResendClient(user.id),
            db.query.userSettings.findFirst({ where: eq(userSettings.userId, user.id) }),
          ]);
          if (!resend || !settings) throw new Error("Resend credentials or sender settings are missing");

          const { error } = await resend.emails.send({
            from: `${settings.senderName} <${settings.senderEmail}>`,
            to: [user.email],
            subject: "Reset your Mailing password",
            text: `Use this secure link to reset your Mailing password. It expires soon and can only be used once:\n\n${url}\n\nIf you did not request a reset, you can ignore this email.`,
          });
          if (error) throw error;
        } catch (error) {
          console.error("Failed to send password reset email:", error);
        }
      });
    },
  },
  plugins: [dash(), sentinel({ kvUrl: process.env.BETTER_AUTH_KV_URL })],
  advanced: {
    database: {
      joins: true, 
    },
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
    },
  },
});
