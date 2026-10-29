/**
 * Push endpoints are URLs the server will call, so they must belong to a real browser push service.
 * Anything else (an internal address, a look-alike host, a URL with credentials or a port) is refused,
 * both when it is saved and again just before it is used. Pure.
 */
const PUSH_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Opera, Brave
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)?push\.apple\.com$/, // Safari
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // Edge on Windows
];

export function isAllowedPushEndpoint(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  return PUSH_HOSTS.some((r) => r.test(host));
}
