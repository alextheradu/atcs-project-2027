"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, isEmailLocked, type Kind, type Pref } from "@/lib/notify/policy";
import { removePushSubscription, savePreferences, savePushSubscription } from "@/lib/notify/actions";

interface Props {
  kinds: Kind[];
  initial: Record<string, Pref>;
  /** How many devices are subscribed. */
  devices: number;
}

const b64ToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const toB64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

type Install = Event & { prompt: () => Promise<void> };

interface Caps {
  ios: boolean;
  standalone: boolean;
  supported: boolean;
  denied: boolean;
}
// Capabilities cannot change while the page is open, so read them once. The server snapshot is null.
let capsCache: Caps | null = null;
const readCaps = (): Caps =>
  (capsCache ??= {
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    denied: "Notification" in window && Notification.permission === "denied",
  });
const noSubscribe = () => () => {};

export function NotificationSettings({ kinds, initial, devices }: Props) {
  const [prefs, setPrefs, draft] = useDraftState("settings:notifications", initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const caps = useSyncExternalStore(noSubscribe, readCaps, () => null);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [install, setInstall] = useState<Install | null>(null);
  const ios = caps?.ios ?? false;
  const standalone = caps?.standalone ?? false;
  const pushState: "unsupported" | "off" | "on" | "denied" = !caps ? "off" : !caps.supported ? "unsupported" : caps.denied || blocked ? "denied" : subscribed ? "on" : "off";

  const supported = caps?.supported ?? false;
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setSubscribed(!!s)).catch(() => {});
  }, [supported]);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as Install); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const set = (kind: Kind, key: "email" | "push", v: boolean) => setPrefs({ ...prefs, [kind]: { ...prefs[kind], [key]: v } });

  function save() {
    setMsg(null);
    start(async () => {
      try {
        const r = await savePreferences(kinds.map((k) => ({ kind: k, ...prefs[k] })));
        if (r.ok) draft.commit(prefs);
        setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
      } catch { setMsg({ ok: false, text: SAVE_INTERRUPTED }); }
    });
  }

  function enablePush() {
    setMsg(null);
    start(async () => {
      try {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) return setMsg({ ok: false, text: "Push is not set up on this server yet." });
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setBlocked(perm === "denied"); return setMsg({ ok: false, text: "Notifications are blocked for this site. Allow them in your browser settings, then try again." }); }
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
        const r = await savePushSubscription({ endpoint: sub.endpoint, p256dh: toB64(sub.getKey("p256dh")), auth: toB64(sub.getKey("auth")), userAgent: navigator.userAgent.slice(0, 200) });
        if (r.ok) { setSubscribed(true); setMsg({ ok: true, text: "Push is on for this device. Turn on Push for the messages you want below." }); } else setMsg({ ok: false, text: r.error });
      } catch { setMsg({ ok: false, text: "This device could not be set up for push." }); }
    });
  }

  function disablePush() {
    start(async () => {
      try {
        const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
        setSubscribed(false);
      } catch { setMsg({ ok: false, text: "Could not turn push off. Try again." }); }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="pb-2 font-normal">Tell me when</th>
              <th scope="col" className="w-16 pb-2 font-normal">In app</th>
              <th scope="col" className="w-16 pb-2 font-normal">Email</th>
              <th scope="col" className="w-16 pb-2 font-normal">Push</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-y border-line">
            {kinds.map((k) => (
              <tr key={k}>
                <th scope="row" className="py-2.5 pr-4 font-normal">{KIND_LABEL[k]}</th>
                <td><input type="checkbox" checked disabled aria-label={`${KIND_LABEL[k]}: in app, always on`} /></td>
                <td><input type="checkbox" checked={prefs[k].email || isEmailLocked(k)} disabled={isEmailLocked(k)} onChange={(e) => set(k, "email", e.target.checked)} aria-label={`${KIND_LABEL[k]}: email`} /></td>
                <td><input type="checkbox" checked={prefs[k].push} onChange={(e) => set(k, "push", e.target.checked)} aria-label={`${KIND_LABEL[k]}: push`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" disabled={pending} onClick={save}>Save</Button>
          <DraftNotice drafts={[draft]} />
        </div>
      </div>

      <div className="space-y-2 border-t border-line pt-6">
        <h3 className="text-sm font-medium">Push on this device</h3>
        {pushState === "unsupported" && <p className="text-[13px] text-muted">{ios && !standalone ? "On iPhone and iPad, push works only after you tap Share, then Add to Home Screen, and open the app from there. It needs iOS 16.4 or later." : "This browser does not support push."}</p>}
        {pushState === "denied" && <p className="text-[13px] text-muted">Notifications are blocked for this site. Allow them in your browser settings, then reload.</p>}
        {(pushState === "off" || pushState === "on") && (
          <div className="flex flex-wrap items-center gap-3">
            {pushState === "off" ? <Button disabled={pending} onClick={enablePush}>Turn on push here</Button> : <Button variant="danger" disabled={pending} onClick={disablePush}>Turn off push here</Button>}
            <span className="text-[13px] text-muted">{devices > 0 ? `${devices} ${devices === 1 ? "device" : "devices"} subscribed` : "No device subscribed yet"}</span>
          </div>
        )}
        {ios && !standalone && pushState !== "unsupported" && <p className="text-xs text-muted">On iPhone, push only works from the Home Screen app (iOS 16.4 or later).</p>}
      </div>

      <div className="space-y-2 border-t border-line pt-6">
        <h3 className="text-sm font-medium">Install the app</h3>
        {standalone ? <p className="text-[13px] text-muted">You are using the installed app.</p> : install ? (
          <Button disabled={pending} onClick={() => install.prompt().then(() => setInstall(null))}>Install</Button>
        ) : (
          <p className="text-[13px] text-muted">{ios ? "Tap Share, then Add to Home Screen." : "Use your browser menu and choose Install app, or Add to Home Screen."}</p>
        )}
      </div>

      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{msg.text}</p>}
    </div>
  );
}
