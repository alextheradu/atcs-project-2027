/** Dev-only sign-in so features can be checked without Google credentials. Never active in production. */
export function isDevAuthEnabled(env: { NODE_ENV?: string; DEV_AUTH?: string }): boolean {
  return (env.NODE_ENV === "development" || env.NODE_ENV === "test") && env.DEV_AUTH === "true";
}
