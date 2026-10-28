import type { Department, Role } from "@/lib/auth/policy";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image?: string | null;
      role: Role;
      departments: Department[];
    };
  }
}
