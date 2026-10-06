import { Breadcrumbs } from "../components/Breadcrumbs";
import { breadcrumbLd } from "../lib/structured-data";
import { type PolicyPage } from "../lib/policies";
import { SITE_URL, useSeo } from "../lib/seo";

/** How it works, privacy and terms: plain, readable text shared with the prerendered pages. */
export function Policy({ page }: { page: PolicyPage }) {
  useSeo({
    title: page.title,
    description: page.description,
    path: page.path,
    jsonLd: [
      breadcrumbLd(SITE_URL, [
        ["Home", "/"],
        [page.h1, page.path],
      ]),
    ],
  });
  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumbs
        items={[
          ["Home", "/"],
          [page.h1, page.path],
        ]}
      />
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{page.h1}</h1>
      <p className="mt-3 text-lg text-slate-700 dark:text-slate-300">{page.intro}</p>
      {page.sections.map((s) => {
        const items = s.body.filter((b) => b.startsWith("• "));
        return (
          <section key={s.heading} className="mt-8">
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            {s.body
              .filter((b) => !b.startsWith("• "))
              .map((b) => (
                <p key={b} className="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">
                  <Linkify text={b} />
                </p>
              ))}
            {items.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                {items.map((b) => (
                  <li key={b}>{b.slice(2)}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </article>
  );
}

/** Turns bare https:// URLs in policy text into links. */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https:\/\/\S+?)(?=[.,]?(?:\s|$))/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("https://") ? (
          <a key={i} href={p} className="link break-all" rel="noopener">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </>
  );
}
