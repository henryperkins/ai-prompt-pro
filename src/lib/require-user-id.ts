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
