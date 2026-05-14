// Supabase moved from legacy HS256 JWT API keys to a new key system.
// SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are deprecated.
// The new system injects SUPABASE_SECRET_KEYS and SUPABASE_PUBLISHABLE_KEYS
// as JSON dictionaries: { "default": "<key>" }.
// These helpers read the new format and fall back to the legacy var so the
// code keeps working during any transition period.

export function getServiceRoleKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch { /* fall through */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

export function getAnonKey(): string {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch { /* fall through */ }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}
