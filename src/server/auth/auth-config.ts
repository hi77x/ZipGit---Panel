import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import { getServerEnv } from "@/lib/env";
import { safeCallbackUrl } from "@/lib/url";

const env = getServerEnv();
const secureCookies = new URL(env.NEXT_PUBLIC_APP_URL).protocol === "https:";

export const githubScopes = ["read:user", "user:email", "repo", "workflow", "notifications"] as const;

export const authConfig = {
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [GitHub({
    clientId: env.AUTH_GITHUB_ID,
    clientSecret: env.AUTH_GITHUB_SECRET,
    authorization: { params: { scope: githubScopes.join(" ") } }
  })],
  cookies: {
    sessionToken: {
      name: `${secureCookies ? "__Secure-" : ""}authjs.session-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: secureCookies }
    }
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile) {
        token.githubId = String(profile.id);
        token.login = typeof profile.login === "string" ? profile.login : token.name ?? "github-user";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.githubId ?? token.sub ?? "";
      session.user.login = token.login ?? token.name ?? "github-user";
      session.user.name = token.name;
      session.user.email = token.email ?? "";
      session.user.avatarUrl = typeof token.picture === "string" ? token.picture : null;
      return session;
    },
    async redirect({ url, baseUrl }) {
      const candidate = new URL(url, baseUrl);
      if (candidate.origin === new URL(baseUrl).origin) return candidate.toString();
      return new URL(safeCallbackUrl(null), baseUrl).toString();
    }
  }
} satisfies NextAuthConfig;
