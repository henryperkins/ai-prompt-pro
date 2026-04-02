import { assertBackendConfigured } from "@/lib/backend-config";
import { decodeJwtPayload, getValidAccessToken } from "@/lib/browser-auth";

export async function requireUserId(featureLabel = "Account actions"): Promise<string> {
  assertBackendConfigured(featureLabel);

  const accessToken = await getValidAccessToken();
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  const userId = typeof payload?.sub === "string" ? payload.sub : null;

  if (!userId) {
    throw new Error("Sign in required.");
  }

  return userId;
}

export async function requireAuthContext(
  featureLabel = "Account actions",
): Promise<{ userId: string; accessToken: string }> {
  assertBackendConfigured(featureLabel);

  const accessToken = await getValidAccessToken();
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  const userId = typeof payload?.sub === "string" ? payload.sub : null;

  if (!userId || !accessToken) {
    throw new Error("Sign in required.");
  }

  return { userId, accessToken };
}
