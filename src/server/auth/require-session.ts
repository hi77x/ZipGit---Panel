import "server-only";
import { auth } from "@/auth";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/shared/contracts/api-error";

export async function requireGitHubSession() {
  const session = await auth();
  const env = getServerEnv();
  const token = await getToken({
    req: { headers: await headers() },
    secret: env.AUTH_SECRET,
    secureCookie: new URL(env.NEXT_PUBLIC_APP_URL).protocol === "https:"
  });
  if (!session?.user || typeof token?.accessToken !== "string") {
    throw new AppError("UNAUTHENTICATED", "Sign in with GitHub to continue.", 401);
  }
  return { user: session.user, accessToken: token.accessToken };
}
