"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { Row, Rows, Section } from "@/components/ui/page";
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

type Msg = { ok: boolean; text: string; at: "save" | "device" };
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
  const [msg, setMsg] = useState<Msg | null>(null);
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
        setMsg(r.ok ? { ok: true, text: "Saved.", at: "save" } : { ok: false, text: r.error, at: "save" });
      } catch { setMsg({ ok: false, text: SAVE_INTERRUPTED, at: "save" }); }
    });
  }

  function enablePush() {
    setMsg(null);
    start(async () => {
      try {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) return setMsg({ ok: false, text: "Push is not set up on this server yet.", at: "device" });
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setBlocked(perm === "denied"); return setMsg({ ok: false, text: "Notifications are blocked for this site. Allow them in your browser settings, then try again.", at: "device" }); }
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
        const r = await savePushSubscription({ endpoint: sub.endpoint, p256dh: toB64(sub.getKey("p256dh")), auth: toB64(sub.getKey("auth")), userAgent: navigator.userAgent.slice(0, 200) });
        if (r.ok) { setSubscribed(true); setMsg({ ok: true, text: "Push is on for this device. Tick Push for the messages you want under Notifications.", at: "device" }); } else setMsg({ ok: false, text: r.error, at: "device" });
      } catch { setMsg({ ok: false, text: "This device could not be set up for push.", at: "device" }); }
    });
  }

  function disablePush() {
    start(async () => {
      try {
        const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
        setSubscribed(false);
      } catch { setMsg({ ok: false, text: "Could not turn push off. Try again.", at: "device" }); }
    });
  }

  const note = (at: Msg["at"]) =>
    msg?.at === at && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-3 text-[13px] text-green" : "mt-3 text-[13px] text-red"}>{msg.text}</p>;

  const pushText =
    pushState === "unsupported"
      ? ios && !standalone
        ? "On iPhone and iPad, push works only after you tap Share, then Add to Home Screen, and open the app from there. It needs iOS 16.4 or later."
        : "This browser does not support push."
      : pushState === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser settings, then reload."
        : `${devices > 0 ? `${devices} ${devices === 1 ? "device" : "devices"} subscribed.` : "No device subscribed yet."}${ios && !standalone ? " On iPhone, push only works from the Home Screen app (iOS 16.4 or later)." : ""}`;

  return (
    <>
      <Section split title="Notifications" description="Choose how you hear about reviews, plans and dates. In app messages are always on.">
        <table className="soft w-full text-left text-[14px]">
          <thead>
            <tr className="text-[13px] text-muted">
              <th scope="col" className="px-4 pb-2 pt-3 font-normal">Tell me when</th>
              <th scope="col" className="w-16 pb-2 pt-3 font-normal">In app</th>
              <th scope="col" className="w-16 pb-2 pt-3 font-normal">Email</th>
              <th scope="col" className="w-16 pb-2 pt-3 font-normal">Push</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k}>
                <th scope="row" className="py-2.5 pl-4 pr-4 font-normal">{KIND_LABEL[k]}</th>
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
        {note("save")}
      </Section>

      <Section split title="This device" description="Push and the installed app work per browser, so set them up on each phone or laptop you use.">
        <Rows>
          <Row title="Push notifications" description={pushText}>
            {pushState === "off" && <Button size="sm" disabled={pending} onClick={enablePush}>Turn on</Button>}
            {pushState === "on" && <Button size="sm" variant="danger" disabled={pending} onClick={disablePush}>Turn off</Button>}
          </Row>
          <Row
            title="Install the app"
            description={standalone ? "You are using the installed app." : install ? "Opens like an app, with its own icon." : ios ? "Tap Share, then Add to Home Screen." : "Use your browser menu and choose Install app, or Add to Home Screen."}
          >
            {!standalone && install && <Button size="sm" disabled={pending} onClick={() => install.prompt().then(() => setInstall(null))}>Install</Button>}
          </Row>
        </Rows>
        {note("device")}
      </Section>
    </>
  );
}
