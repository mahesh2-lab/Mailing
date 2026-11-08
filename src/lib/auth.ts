import { betterAuth } from "better-auth";
import { dash, sentinel } from "@better-auth/infra";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../index";
import * as authSchema from "../db/auth-schema";

export const auth = betterAuth({
  appName: "Mailing",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema, 
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
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
