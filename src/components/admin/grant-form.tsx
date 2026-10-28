"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createGrant, deleteGrant } from "@/lib/admin/users";
import { ROLES, DEPARTMENTS } from "@/lib/admin/schemas";
import { DeptPicker } from "./user-role-form";

type Role = (typeof ROLES)[number];
type Dept = (typeof DEPARTMENTS)[number];

export function GrantForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("COUNSELOR");
  const [depts, setDepts] = useState<Dept[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createGrant({ email, role, departments: depts });
      setMsg(r.ok ? { ok: true, text: "Grant saved" } : { ok: false, text: r.error });
      if (r.ok) setEmail("");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input !w-64"
          type="email"
          required
          placeholder="person@pascack.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <select className="input !w-auto" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <Button type="submit" variant="primary" disabled={pending}>
          Create grant
        </Button>
      </div>
      {role === "SUPERVISOR" && <DeptPicker value={depts} onChange={setDepts} />}
      <p className="text-[13px] text-muted">
        Staff roles only work for @pascack.org addresses. A student grant works as an invite for any address.
      </p>
      {msg && (
        <p role="status" className={msg.ok ? "text-sm text-green" : "text-sm text-red"}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

export function DeleteGrantButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => void (await deleteGrant(id)))}>
      Delete
    </Button>
  );
}
