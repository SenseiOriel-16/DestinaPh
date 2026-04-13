import type { SupabaseClient } from "@supabase/supabase-js";

/** Letters, numbers, underscore; 3–24 chars (stored lowercase). */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/i;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsernameFormat(raw: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(raw));
}

export async function resolveLoginEmail(
  supabase: SupabaseClient,
  identifier: string,
): Promise<{ email: string | null; error?: string }> {
  const v = identifier.trim();
  if (!v) {
    return { email: null, error: "Enter your email or username." };
  }
  if (v.includes("@")) {
    return { email: v.toLowerCase() };
  }
  const { data, error } = await supabase.rpc("login_identifier_to_email", { p_identifier: v });
  if (error) {
    return { email: null, error: error.message };
  }
  const email = typeof data === "string" && data.length > 0 ? data : null;
  return { email };
}
