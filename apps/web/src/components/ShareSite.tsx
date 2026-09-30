import { useData } from "../lib/data";
import { appUrl } from "../lib/format";
import { siteShareMessage, whatsappUrl } from "../lib/share";
import { LinkIcon, WhatsAppIcon } from "./Icons";
import { useToast } from "./Toast";

/** The introduction message with the live counts, for the share buttons. */
export function useSiteShareMessage() {
  const { meta } = useData();
  const open = meta?.totals.open ?? 0;
  return siteShareMessage(appUrl("/"), open ? { open, companies: meta!.totals.companiesWithJobs } : undefined);
}

/** "Know someone looking for a job?" card: send Rekiya on WhatsApp or copy the introduction message. */
export function ShareSite() {
  const message = useSiteShareMessage();
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ message: "Message copied — paste it into any chat" });
    } catch {
      toast({ message: "Couldn't copy — your browser blocked the clipboard" });
    }
  };
  return (
    <section
      aria-labelledby="share-h"
      className="mt-14 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      <h2 id="share-h" className="text-xl font-bold">
        Know someone looking for a job?
      </h2>
      <p className="mt-1 max-w-2xl text-slate-700 dark:text-slate-300">
        Send them Rekiya. The link opens with a preview card, and the message explains what it is in a few lines.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" className="btn-primary" aria-label="Share on WhatsApp">
          <WhatsAppIcon width={18} height={18} /> Share on WhatsApp
        </a>
        <button type="button" className="btn-secondary" onClick={copy}>
          <LinkIcon width={18} height={18} /> Copy message
        </button>
      </div>
    </section>
  );
}

/** Compact footer link. */
export function ShareSiteLink() {
  const message = useSiteShareMessage();
  return (
    <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5 font-normal">
      <WhatsAppIcon width={14} height={14} /> Share Rekiya on WhatsApp
    </a>
  );
}
