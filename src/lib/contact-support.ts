import { apiFetch } from "@/lib/api-client";
import { assertBackendConfigured } from "@/lib/backend-config";
import { sanitizePostgresText } from "@/lib/saved-prompt-shared";

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

interface ApiContactMessageRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_country: string;
  phone_number: string;
  message: string;
  status: ContactMessageStatus;
  requester_user_id: string | null;
  created_at: number;
  updated_at: number;
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

function toIsoString(value: number): string {
  return new Date(value * 1000).toISOString();
}

function mapContactMessage(row: ApiContactMessageRecord): ContactMessageRecord {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phoneCountry: row.phone_country,
    phoneNumber: row.phone_number,
    message: row.message,
    status: normalizeStatus(row.status),
    requesterUserId: row.requester_user_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function isSupportReviewer(): Promise<boolean> {
  assertBackendConfigured("Contact support");
  const result = await apiFetch<{ allowed: boolean }>("/api/support/reviewer");
  return result.allowed;
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

  const result = await apiFetch<{ id: string }>("/api/support/contact", {
    method: "POST",
    body: JSON.stringify({
      firstName,
      lastName,
      email,
      phoneCountry,
      phoneNumber,
      message,
      privacyConsent: true,
    }),
  });

  return result.id;
}

export async function listContactMessagesForReviewer(limit = SUPPORT_INBOX_PAGE_SIZE): Promise<ContactMessageRecord[]> {
  assertBackendConfigured("Contact support");

  const pageSize = Math.max(1, Math.min(limit, 500));
  const rows = await apiFetch<ApiContactMessageRecord[]>(`/api/support/messages?limit=${pageSize}`);
  return rows.map(mapContactMessage);
}

export async function updateContactMessageStatus(
  messageId: string,
  status: ContactMessageStatus,
): Promise<void> {
  assertBackendConfigured("Contact support");

  const id = sanitizePostgresText(messageId).trim();
  if (!id) {
    throw new Error("Message id is required.");
  }

  await apiFetch(`/api/support/messages/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}
