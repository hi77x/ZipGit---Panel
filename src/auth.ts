import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/auth-config";

export { authConfig, githubScopes } from "@/server/auth/auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
