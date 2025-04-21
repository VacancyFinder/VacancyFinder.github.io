import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, XIcon } from "./Icons";

export interface ToastInput {
  message: string;
  /** e.g. { label: "Undo", onClick } */
  action?: { label: string; onClick: () => void };
}
interface ToastItem extends ToastInput {
  id: number;
}

const Ctx = createContext<((t: ToastInput) => void) | null>(null);
const DURATION = 5000;

/** Short confirmations ("Saved", "Hidden — Undo") announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((t: ToastInput) => {
    const id = next.current++;
    // Keep at most three on screen.
    setItems((l) => [...l.slice(-2), { ...t, id }]);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-3 md:bottom-6"
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function Toast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(onDone, DURATION);
    return () => clearTimeout(t);
  }, [paused, onDone]);
  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-slate-900 py-2 pl-4 pr-2 text-sm text-white shadow-lg ring-1 ring-black/10 dark:bg-slate-100 dark:text-slate-900"
    >
      <CheckIcon width={16} height={16} className="shrink-0 text-emerald-400 dark:text-emerald-600" />
      <span className="flex-1">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="min-h-[40px] rounded-lg px-3 font-semibold text-amber-300 hover:bg-white/10 dark:text-brand-800 dark:hover:bg-slate-200"
          onClick={() => {
            item.action!.onClick();
            onDone();
          }}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 dark:text-slate-600 dark:hover:bg-slate-200"
        onClick={onDone}
      >
        <XIcon width={16} height={16} />
      </button>
    </div>
  );
}

export function useToast(): (t: ToastInput) => void {
  const v = useContext(Ctx);
  // Outside the provider (tests), toasts are a no-op rather than a crash.
  return useMemo(() => v ?? (() => {}), [v]);
}
