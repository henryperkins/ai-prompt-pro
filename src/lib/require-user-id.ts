import { neon } from "@/integrations/neon/client";
import { assertBackendConfigured } from "@/lib/backend-config";

function toAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Authentication failed.";
  }

  const message = typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message.trim()
    : "";

  return message || "Authentication failed.";
}

export async function requireUserId(featureLabel = "Account actions"): Promise<string> {
  assertBackendConfigured(featureLabel);

  const { data, error } = await neon.auth.getUser();
  if (error) {
    throw new Error(toAuthErrorMessage(error));
  }

  if (!data.user?.id) {
    throw new Error("Sign in required.");
  }

  return data.user.id;
}
