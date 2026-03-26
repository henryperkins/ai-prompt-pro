import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../workers/lib/auth";

describe("worker auth utilities", () => {
  it("verifies the original password against its stored hash", async () => {
    const password = "Passw0rd!";
    const storedHash = await hashPassword(password);

    await expect(verifyPassword(password, storedHash)).resolves.toBe(true);
    await expect(verifyPassword("different-password", storedHash)).resolves.toBe(false);
  });

  it("fails closed for malformed hashes", async () => {
    await expect(verifyPassword("Passw0rd!", "not-a-real-hash")).resolves.toBe(false);
  });
});
