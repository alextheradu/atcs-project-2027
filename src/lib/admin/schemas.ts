import { z } from "zod";

export const ROLES = ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR", "ADMIN"] as const;
export const DEPARTMENTS = [
  "ENGLISH",
  "SOCIAL_STUDIES",
  "MATH",
  "COMPUTER_SCIENCE",
  "SCIENCE",
  "WORLD_LANGUAGE",
  "ART",
  "BUSINESS",
  "FAMILY_CONSUMER_SCIENCES",
  "HEALTH_PE",
  "MUSIC",
  "TECHNOLOGY",
  "SPECIAL_ED",
  "OTHER",
] as const;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, "Enter a domain like school.org");

export const changeRoleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(ROLES),
  departments: z.array(z.enum(DEPARTMENTS)).max(DEPARTMENTS.length).default([]),
});

export const createGrantSchema = z.object({
  email: emailSchema,
  role: z.enum(ROLES),
  departments: z.array(z.enum(DEPARTMENTS)).max(DEPARTMENTS.length).default([]),
});

export const signupModeSchema = z.enum(["DOMAIN_ALLOWLIST", "OPEN", "INVITE_ONLY"]);

export const addDomainSchema = z.object({
  domain: domainSchema,
  cohort: z.enum(["CURRENT", "INCOMING_8"]),
  label: z.string().trim().max(80).optional(),
});

export const searchSchema = z.string().trim().max(100);
