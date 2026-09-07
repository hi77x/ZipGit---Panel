import { describe, expect, it } from "vitest";
import { normalizeActivityEvent } from "./activity-service";

describe("activity normalization", () => {
  it("normalizes push events without returning raw payload", () => {
    const item = normalizeActivityEvent({ id: "1", type: "PushEvent", created_at: new Date().toISOString(), actor: { login: "octo", avatar_url: null }, payload: { ref: "refs/heads/main", commits: [{}, {}] } });
    expect(item.summary).toBe("pushed 2 commits to main");
    expect(item).not.toHaveProperty("payload");
  });
  it("degrades unknown events safely", () => {
    expect(normalizeActivityEvent({ id: "2", type: "NewThingEvent", created_at: new Date().toISOString(), actor: null, payload: {} }).summary).toBe("NewThing event");
  });
});
