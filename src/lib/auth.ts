import { betterAuth } from "better-auth";
import { dash, sentinel } from "@better-auth/infra";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../index";
import * as authSchema from "../db/auth-schema";

export const auth = betterAuth({
  appName: "Mailling",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema, 
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [dash(), sentinel()],
  advanced: {
    database: {
      joins: true, 
    },
    ipAddress: {
      ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],
    },
  },
});
