import { describe, expect, it } from "vitest";
import { authConfig, githubScopes } from "./auth-config";

type AnyRecord = Record<string, unknown>;

const callbacks = authConfig.callbacks as unknown as {
  jwt: (args: AnyRecord) => Promise<AnyRecord>;
  session: (args: AnyRecord) => Promise<AnyRecord>;
  redirect: (args: { url: string; baseUrl: string }) => Promise<string>;
};

describe("authentication boundary", () => {
  it("requests exactly the documented scopes and never delete_repo", () => {
    const provider = authConfig.providers[0] as unknown as {
      options?: { authorization?: { params?: { scope?: string } } };
      authorization?: { params?: { scope?: string } };
    };
    const scope = provider.options?.authorization?.params?.scope ?? provider.authorization?.params?.scope ?? "";
    expect(scope).toContain("repo");
    expect(scope).toContain("workflow");
    expect(scope).toContain("notifications");
    expect(scope).not.toContain("delete_repo");
    expect([...githubScopes]).toEqual(["read:user", "user:email", "repo", "workflow", "notifications"]);
  });

  it("stores the GitHub access token in the JWT and never in the session payload", async () => {
    const token = await callbacks.jwt({ token: { name: "Octo" }, account: { access_token: "gho_server_only" }, profile: { id: 42, login: "octo" } });
    expect(token.accessToken).toBe("gho_server_only");
    expect(token.githubId).toBe("42");
    expect(token.login).toBe("octo");

    const session = await callbacks.session({ session: { user: { name: "Octo" }, expires: "2099-01-01" }, token });
    expect(session.user).toMatchObject({ id: "42", login: "octo", avatarUrl: null });
    expect(JSON.stringify(session)).not.toContain("gho_server_only");
    expect(JSON.stringify(session)).not.toContain("accessToken");
  });

  it("blocks redirects to external origins", async () => {
    const sameOrigin = await callbacks.redirect({ url: "http://localhost:3000/dashboard", baseUrl: "http://localhost:3000" });
    expect(sameOrigin).toBe("http://localhost:3000/dashboard");
    const external = await callbacks.redirect({ url: "https://evil.example/steal", baseUrl: "http://localhost:3000" });
    expect(external.startsWith("http://localhost:3000")).toBe(true);
  });

  it("uses an HttpOnly, SameSite=Lax session cookie with an explicit lifetime", () => {
    expect(authConfig.session).toMatchObject({ strategy: "jwt", maxAge: 30 * 24 * 60 * 60 });
    const cookie = authConfig.cookies as { sessionToken: { name: string; options: { httpOnly: boolean; sameSite: string; secure: boolean; path: string } } };
    expect(cookie.sessionToken.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie.sessionToken.name).toBe("authjs.session-token");
    expect(cookie.sessionToken.options.secure).toBe(false);
  });
});
