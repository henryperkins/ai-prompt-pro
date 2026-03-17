import { beforeEach, describe, expect, it } from "vitest";
import { createAuthThrottle, createPersistedAuthThrottle } from "@/lib/auth-throttle";

describe("auth throttle", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("allows attempts below the threshold", () => {
    const now = 1_000;
    const throttle = createAuthThrottle({
      threshold: 3,
      cooldownMs: 30_000,
      now: () => now,
    });

    expect(throttle.canAttempt()).toBe(true);
    throttle.recordFailure();
    expect(throttle.canAttempt()).toBe(true);
    throttle.recordFailure();
    expect(throttle.canAttempt()).toBe(true);
    expect(throttle.remainingCooldownMs()).toBe(0);
  });

  it("starts a cooldown when the threshold is reached", () => {
    const now = 1_000;
    const throttle = createAuthThrottle({
      threshold: 3,
      cooldownMs: 30_000,
      now: () => now,
    });

    throttle.recordFailure();
    throttle.recordFailure();
    throttle.recordFailure();

    expect(throttle.canAttempt()).toBe(false);
    expect(throttle.remainingCooldownMs()).toBe(30_000);
  });

  it("expires the cooldown automatically", () => {
    let now = 1_000;
    const throttle = createAuthThrottle({
      threshold: 1,
      cooldownMs: 30_000,
      now: () => now,
    });

    throttle.recordFailure();
    expect(throttle.canAttempt()).toBe(false);

    now += 30_000;

    expect(throttle.canAttempt()).toBe(true);
    expect(throttle.remainingCooldownMs()).toBe(0);
  });

  it("clears the failure counter after a successful attempt", () => {
    const now = 1_000;
    const throttle = createAuthThrottle({
      threshold: 3,
      cooldownMs: 30_000,
      now: () => now,
    });

    throttle.recordFailure();
    throttle.recordFailure();
    throttle.recordSuccess();

    throttle.recordFailure();
    throttle.recordFailure();

    expect(throttle.canAttempt()).toBe(true);
    expect(throttle.remainingCooldownMs()).toBe(0);
  });

  it("persists cooldown state by normalized identifier", () => {
    let now = 1_000;
    const persisted = createPersistedAuthThrottle("User@example.com", {
      threshold: 1,
      cooldownMs: 30_000,
      now: () => now,
    });

    persisted.recordFailure();

    const reopened = createPersistedAuthThrottle("user@example.com", {
      threshold: 1,
      cooldownMs: 30_000,
      now: () => now,
    });
    const differentUser = createPersistedAuthThrottle("other@example.com", {
      threshold: 1,
      cooldownMs: 30_000,
      now: () => now,
    });

    expect(reopened.canAttempt()).toBe(false);
    expect(differentUser.canAttempt()).toBe(true);

    now += 30_000;

    expect(reopened.canAttempt()).toBe(true);
    expect(
      createPersistedAuthThrottle("user@example.com", {
        threshold: 1,
        cooldownMs: 30_000,
        now: () => now,
      }).remainingCooldownMs(),
    ).toBe(0);
  });
});
