import { neon } from "@/integrations/neon/client";
import type { TablesInsert } from "@/integrations/neon/types";
import { assertBackendConfigured } from "@/lib/backend-config";
import { isPostgrestError, sanitizePostgresText } from "@/lib/saved-prompt-shared";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_COUNTRY_LENGTH = 8;
const MAX_PHONE_NUMBER_LENGTH = 50;
const MAX_MESSAGE_LENGTH = 5000;
const SUPPORT_INBOX_PAGE_SIZE = 100;

export interface ContactMessageInput {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  phoneCountry?: string;
  phoneNumber?: string;
  privacyConsent: boolean;
}

export type ContactMessageStatus = "new" | "reviewing" | "resolved";

export interface ContactMessageRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountry: string;
  phoneNumber: string;
  message: string;
  status: ContactMessageStatus;
  requesterUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (isPostgrestError(error)) {
    return new Error(error.message || fallback);
  }
  return new Error(fallback);
}

function normalizeRequiredText(value: string, label: string, maxLength: number): string {
  const normalized = sanitizePostgresText(value).trim().slice(0, maxLength);
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined, maxLength: number): string {
  return sanitizePostgresText(value || "").trim().slice(0, maxLength);
}

function normalizeStatus(value: string): ContactMessageStatus {
  if (value === "reviewing" || value === "resolved") return value;
  return "new";
}

async function requireReviewerUserId(): Promise<string> {
  const { data: authData, error: authError } = await neon.auth.getUser();
  if (authError) {
    throw toError(authError, "Authentication failed.");
  }
  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("Sign in required.");
  }

  const { data: reviewer, error } = await neon
    .from("support_reviewers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw toError(error, "Failed to verify reviewer access.");
  }
  if (!reviewer?.user_id) {
    throw new Error("You do not have support inbox access.");
  }

  return userId;
}

export async function isSupportReviewer(): Promise<boolean> {
  assertBackendConfigured("Contact support");
  const { data: authData, error: authError } = await neon.auth.getUser();
  if (authError) throw toError(authError, "Authentication failed.");

  const userId = authData.user?.id;
  if (!userId) return false;

  const { data, error } = await neon
    .from("support_reviewers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw toError(error, "Failed to verify reviewer access.");
  }

  return Boolean(data?.user_id);
}

export async function submitContactMessage(input: ContactMessageInput): Promise<string> {
  assertBackendConfigured("Contact support");

  const firstName = normalizeRequiredText(input.firstName, "First name", MAX_NAME_LENGTH);
  const lastName = normalizeRequiredText(input.lastName, "Last name", MAX_NAME_LENGTH);
  const email = normalizeRequiredText(input.email, "Email", MAX_EMAIL_LENGTH).toLowerCase();
  const message = normalizeRequiredText(input.message, "Message", MAX_MESSAGE_LENGTH);
  const phoneCountry = normalizeOptionalText(input.phoneCountry, MAX_PHONE_COUNTRY_LENGTH).toUpperCase() || "US";
  const phoneNumber = normalizeOptionalText(input.phoneNumber, MAX_PHONE_NUMBER_LENGTH);

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  if (!input.privacyConsent) {
    throw new Error("Please accept the privacy policy before sending.");
  }

  const payload: TablesInsert<"contact_messages"> = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone_country: phoneCountry,
    phone_number: phoneNumber,
    message,
    privacy_consent: true,
  };

  try {
    const { data, error } = await neon
      .from("contact_messages")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw error;
    if (!data?.id) {
      throw new Error("Contact message was submitted without an id.");
    }

    return data.id;
  } catch (error) {
    throw toError(error, "Failed to send message.");
  }
}

export async function listContactMessagesForReviewer(limit = SUPPORT_INBOX_PAGE_SIZE): Promise<ContactMessageRecord[]> {
  assertBackendConfigured("Contact support");
  await requireReviewerUserId();

  const pageSize = Math.max(1, Math.min(limit, 500));
  try {
    const { data, error } = await neon
      .from("contact_messages")
      .select("id, first_name, last_name, email, phone_country, phone_number, message, status, requester_user_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phoneCountry: row.phone_country,
      phoneNumber: row.phone_number,
      message: row.message,
      status: normalizeStatus(row.status),
      requesterUserId: row.requester_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    throw toError(error, "Failed to load contact messages.");
  }
}

export async function updateContactMessageStatus(
  messageId: string,
  status: ContactMessageStatus,
): Promise<void> {
  assertBackendConfigured("Contact support");
  await requireReviewerUserId();

  const id = sanitizePostgresText(messageId).trim();
  if (!id) {
    throw new Error("Message id is required.");
  }

  try {
    const { error } = await neon
      .from("contact_messages")
      .update({ status })
      .eq("id", id);

    if (error) throw error;
  } catch (error) {
    throw toError(error, "Failed to update contact message status.");
  }
}
