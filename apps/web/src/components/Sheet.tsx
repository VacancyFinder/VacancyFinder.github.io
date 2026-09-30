import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "./Icons";

/**
 * A bottom sheet on phones, a centred dialog elsewhere. Built on <dialog>.showModal(), so focus is
 * trapped, Escape closes it and the page behind is inert without extra code.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // jsdom and very old browsers lack showModal.
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
      document.body.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    if (!open) document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="sheet-in m-0 mt-auto flex max-h-[92dvh] w-full max-w-none flex-col rounded-t-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 open:flex dark:bg-slate-900 dark:text-slate-100 sm:m-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl [&:not([open])]:hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <h2 id="sheet-title" className="text-base font-semibold">
          {title}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <XIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">{footer}</div>}
    </dialog>
  );
}
