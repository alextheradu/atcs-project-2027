import { describe, expect, it } from "vitest";
import { isPermanentSmtpError, smtpConfig } from "./smtp";

const base = { SMTP_HOST: "smtp.example.com", SMTP_USER: "planner", SMTP_PASSWORD: "pw", EMAIL_FROM: "Planner <planner@example.com>" };

describe("smtpConfig", () => {
  it("is null until host and sender are set, so email stays off rather than half configured", () => {
    expect(smtpConfig({})).toBeNull();
    expect(smtpConfig({ ...base, SMTP_HOST: "" })).toBeNull();
    expect(smtpConfig({ ...base, EMAIL_FROM: undefined })).toBeNull();
  });
  it("defaults to port 587 with STARTTLS required, so a password never crosses in plain text", () => {
    expect(smtpConfig(base)).toMatchObject({ host: "smtp.example.com", port: 587, secure: false, requireTLS: true, auth: { user: "planner", pass: "pw" } });
  });
  it("uses implicit TLS on 465 unless told otherwise", () => {
    expect(smtpConfig({ ...base, SMTP_PORT: "465" })).toMatchObject({ port: 465, secure: true });
    expect(smtpConfig({ ...base, SMTP_PORT: "465", SMTP_SECURE: "false" })).toMatchObject({ secure: false });
    expect(smtpConfig({ ...base, SMTP_SECURE: "true" })).toMatchObject({ port: 587, secure: true });
  });
  it("sends no credentials when there is no user", () => {
    expect(smtpConfig({ ...base, SMTP_USER: "", SMTP_PASSWORD: "" })?.auth).toBeUndefined();
  });
  it("rejects a port that is not a port", () => {
    expect(smtpConfig({ ...base, SMTP_PORT: "abc" })).toBeNull();
    expect(smtpConfig({ ...base, SMTP_PORT: "70000" })).toBeNull();
  });
  it("lets a local test server skip TLS only when asked", () => {
    expect(smtpConfig({ ...base, SMTP_REQUIRE_TLS: "false" })).toMatchObject({ requireTLS: false });
  });
});

describe("isPermanentSmtpError", () => {
  it("treats a 5xx rejection of the message or recipient as final", () => {
    expect(isPermanentSmtpError({ code: "EENVELOPE", responseCode: 550 })).toBe(true);
    expect(isPermanentSmtpError({ code: "EMESSAGE", responseCode: 554 })).toBe(true);
  });
  it("retries temporary 4xx replies", () => {
    expect(isPermanentSmtpError({ code: "EENVELOPE", responseCode: 451 })).toBe(false);
  });
  it("retries auth and connection problems, which are the operator's to fix, not the student's address", () => {
    expect(isPermanentSmtpError({ code: "EAUTH", responseCode: 535 })).toBe(false);
    expect(isPermanentSmtpError({ code: "ECONNECTION" })).toBe(false);
    expect(isPermanentSmtpError({ code: "ETIMEDOUT" })).toBe(false);
    expect(isPermanentSmtpError(new Error("socket hang up"))).toBe(false);
    expect(isPermanentSmtpError(null)).toBe(false);
  });
});
