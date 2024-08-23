import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { DownloadIcon } from "./Icons";

/** Shown when a new version has been deployed and is ready. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh && !offlineReady) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl bg-brand-900 p-4 text-white shadow-lg md:bottom-6">
      <p className="text-sm">{needRefresh ? "A new version of Rekiya is available." : "Rekiya is ready to work offline."}</p>
      <div className="mt-3 flex gap-2">
        {needRefresh && (
          <button type="button" className="btn bg-white text-brand-900 hover:bg-brand-50" onClick={() => void updateServiceWorker(true)}>
            Update now
          </button>
        )}
        <button
          type="button"
          className="btn border border-white/40 text-white hover:bg-white/10"
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
        >
          {needRefresh ? "Later" : "OK"}
        </button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Install button that appears only when the browser offers installation. */
export function InstallButton({ className = "btn-secondary" }: { className?: string }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    const done = () => setEvt(null);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", on);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (!evt) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await evt.prompt();
        await evt.userChoice;
        setEvt(null);
      }}
    >
      <DownloadIcon width={18} height={18} /> Install app
    </button>
  );
}
