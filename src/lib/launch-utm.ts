import { normalizeHttpUrl } from "@/lib/url-utils";

export type LaunchUtmChannel =
  | "organic_social"
  | "paid_social"
  | "email"
  | "community"
  | "partner";

export interface LaunchUtmOptions {
  campaign: string;
  channel: LaunchUtmChannel;
  content?: string;
  term?: string;
}

const channelDefaults: Record<LaunchUtmChannel, { source: string; medium: string }> = {
  organic_social: { source: "social", medium: "organic" },
  paid_social: { source: "social", medium: "paid" },
  email: { source: "email", medium: "owned" },
  community: { source: "community", medium: "referral" },
  partner: { source: "partner", medium: "referral" },
};

function normalizeCampaignValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 80);
}

export function buildLaunchTrackedUrl(baseUrl: string, options: LaunchUtmOptions): string | null {
  const normalizedBase = normalizeHttpUrl(baseUrl);
  if (!normalizedBase) return null;

  const campaign = normalizeCampaignValue(options.campaign);
  if (!campaign) return null;

  const defaults = channelDefaults[options.channel];
  const url = new URL(normalizedBase);
  url.searchParams.set("utm_source", defaults.source);
  url.searchParams.set("utm_medium", defaults.medium);
  url.searchParams.set("utm_campaign", campaign);

  if (options.content?.trim()) {
    url.searchParams.set("utm_content", options.content.trim().toLowerCase().replace(/\s+/g, "_"));
  }

  if (options.term?.trim()) {
    url.searchParams.set("utm_term", options.term.trim().toLowerCase().replace(/\s+/g, "_"));
  }

  return url.toString();
}
