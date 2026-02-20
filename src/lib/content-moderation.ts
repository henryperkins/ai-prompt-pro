interface ModerationRule {
  pattern: RegExp;
  reason: string;
}

const COMMUNITY_MODERATION_RULES: ReadonlyArray<ModerationRule> = [
  {
    pattern: /\bkill yourself\b/i,
    reason: "Content promoting self-harm is not allowed.",
  },
  {
    pattern: /\b(?:i|we)\s+(?:will|am going to)\s+(?:kill|hurt|doxx)\b/i,
    reason: "Threatening language is not allowed.",
  },
  {
    pattern: /\b(?:doxx|doxxing|swat)\b/i,
    reason: "Harassment and targeting language is not allowed.",
  },
  {
    pattern: /\b(?:csam|child sexual abuse)\b/i,
    reason: "Sexual exploitation content is not allowed.",
  },
];

export interface ModerationCheck {
  blocked: boolean;
  reason: string | null;
}

export function checkCommunityText(content: string): ModerationCheck {
  const normalized = content.trim();
  if (!normalized) {
    return { blocked: false, reason: null };
  }

  const match = COMMUNITY_MODERATION_RULES.find((rule) => rule.pattern.test(normalized));
  if (!match) {
    return { blocked: false, reason: null };
  }

  return { blocked: true, reason: match.reason };
}

export function assertCommunityTextAllowed(content: string, fallbackMessage: string): void {
  const result = checkCommunityText(content);
  if (result.blocked) {
    throw new Error(result.reason || fallbackMessage);
  }
}
