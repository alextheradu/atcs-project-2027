/** Pure SMTP settings and error rules. No network, no framework. */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  from: string;
}

type Env = Record<string, string | undefined>;

/**
 * Reads SMTP settings. Null means email is off. Port 465 means implicit TLS; any other port must upgrade
 * with STARTTLS before credentials are sent. `SMTP_REQUIRE_TLS=false` exists only for a local test server.
 */
export function smtpConfig(env: Env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!host || !from) return null;
  const port = env.SMTP_PORT?.trim() ? Number(env.SMTP_PORT) : 587;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465;
  const user = env.SMTP_USER?.trim();
  return {
    host,
    port,
    secure,
    requireTLS: !secure && env.SMTP_REQUIRE_TLS !== "false",
    ...(user ? { auth: { user, pass: env.SMTP_PASSWORD ?? "" } } : {}),
    from,
  };
}

/**
 * A 5xx reply about the message or recipient will not change on retry. Login and connection failures
 * are the operator's setup, so those retry and the email still goes out once the setup is fixed.
 */
export function isPermanentSmtpError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const { code, responseCode } = e as { code?: string; responseCode?: number };
  if (code === "EAUTH") return false;
  return typeof responseCode === "number" && responseCode >= 500 && responseCode < 600;
}
