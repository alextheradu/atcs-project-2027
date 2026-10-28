"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { changeUserRole } from "@/lib/admin/users";
import { DEPARTMENTS, ROLES } from "@/lib/admin/schemas";

type Role = (typeof ROLES)[number];
type Dept = (typeof DEPARTMENTS)[number];

export function UserRoleForm({ userId, role: initial, departments: initialDepts }: { userId: string; role: Role; departments: Dept[] }) {
  const [role, setRole] = useState<Role>(initial);
  const [depts, setDepts] = useState<Dept[]>(initialDepts);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await changeUserRole({ userId, role, departments: depts });
      setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.error });
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select className="input !h-8 !w-auto" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={save} disabled={pending}>
          Save
        </Button>
        {msg && (
          <span role="status" className={msg.ok ? "text-xs text-green" : "text-xs text-red"}>
            {msg.text}
          </span>
        )}
      </div>
      {role === "SUPERVISOR" && <DeptPicker value={depts} onChange={setDepts} />}
    </div>
  );
}

export function DeptPicker({ value, onChange }: { value: Dept[]; onChange: (v: Dept[]) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
      <legend className="sr-only">Departments</legend>
      {DEPARTMENTS.map((d) => (
        <label key={d} className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            className="accent-[var(--accent)]"
            checked={value.includes(d)}
            onChange={(e) => onChange(e.target.checked ? [...value, d] : value.filter((x) => x !== d))}
          />
          {d.replace(/_/g, " ").toLowerCase()}
        </label>
      ))}
    </fieldset>
  );
}
