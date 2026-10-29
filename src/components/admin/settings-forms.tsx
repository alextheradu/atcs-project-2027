"use client";

import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { addAllowedDomain, removeAllowedDomain, setDomainEnabled, setSignupMode } from "@/lib/admin/settings";

const MODES = [
  ["DOMAIN_ALLOWLIST", "Domain allowlist", "Only emails from allowed domains can sign up."],
  ["OPEN", "Open", "Any verified Google account can sign up."],
  ["INVITE_ONLY", "Invite only", "Only people with a pre-approved grant can sign up."],
] as const;

export function SignupModeForm({ current }: { current: string }) {
  const [mode, setMode, modeDraft] = useDraftState("settings:signup-mode", current);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <DraftNotice drafts={[modeDraft]} />
      {MODES.map(([value, label, help]) => (
        <label key={value} className="flex cursor-pointer items-start gap-3">
          <input
            type="radio"
            name="mode"
            className="mt-1 accent-[var(--accent)]"
            checked={mode === value}
            onChange={() => setMode(value)}
          />
          <span>
            <span className="block text-sm">{label}</span>
            <span className="block text-[13px] text-muted">{help}</span>
          </span>
        </label>
      ))}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          disabled={pending || mode === current}
          onClick={() =>
            start(async () => {
              try {
                const r = await setSignupMode(mode);
                if (r.ok) modeDraft.commit(mode);
                setMsg(r.ok ? "Saved" : r.error);
              } catch { setMsg(SAVE_INTERRUPTED); }
            })
          }
        >
          Save
        </Button>
        {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}

export function AddDomainForm() {
  const [domain, setDomain, domainDraft] = useDraftState("settings:domain", "");
  const [cohort, setCohort, cohortDraft] = useDraftState<"CURRENT" | "INCOMING_8">("settings:cohort", "INCOMING_8");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await addAllowedDomain({ domain, cohort });
            setMsg(r.ok ? { ok: true, text: "Added" } : { ok: false, text: r.error });
            if (r.ok) { domainDraft.commit(domain, ""); cohortDraft.commit(cohort); }
          } catch { setMsg({ ok: false, text: SAVE_INTERRUPTED }); }
        });
      }}
    >
      <DraftNotice drafts={[domainDraft, cohortDraft]} />
      <input className="input !w-64" placeholder="district.org" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domain" required />
      <select className="input !w-auto" value={cohort} onChange={(e) => setCohort(e.target.value as typeof cohort)} aria-label="Cohort">
        <option value="CURRENT">CURRENT (high school)</option>
        <option value="INCOMING_8">INCOMING_8 (8th graders)</option>
      </select>
      <Button type="submit" variant="primary" disabled={pending}>
        Add domain
      </Button>
      {msg && <span role="status" className={msg.ok ? "text-sm text-green" : "text-sm text-red"}>{msg.text}</span>}
    </form>
  );
}

export function DomainRow({ id, domain, cohort, enabled }: { id: string; domain: string; cohort: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span>
        <span className="num text-[13px]">{domain}</span> <span className="text-muted">{cohort.toLowerCase()}</span>
      </span>
      <span className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => start(async () => void (await setDomainEnabled(id, !enabled)))}>
          {enabled ? "Disable" : "Enable"}
        </Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => void (await removeAllowedDomain(id)))}>
          Remove
        </Button>
      </span>
    </li>
  );
}
