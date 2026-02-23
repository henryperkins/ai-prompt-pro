import { copyTextToClipboard } from "@/lib/clipboard";

export type ShareResult = "native" | "clipboard" | "failed";

export async function sharePost(
  post: { id: string; title: string },
  origin?: string,
): Promise<ShareResult> {
  const url = `${origin ?? window.location.origin}/community/${post.id}`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: post.title, url });
      return "native";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "native";
      }
      // Fall through to clipboard
    }
  }

  try {
    await copyTextToClipboard(url);
    return "clipboard";
  } catch {
    return "failed";
  }
}
