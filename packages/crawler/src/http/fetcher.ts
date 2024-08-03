import robotsParser from "robots-parser";
import { fetch } from "undici";

export const REPO_URL = "https://github.com/VacancyFinder/VacancyFinder.github.io";
export const USER_AGENT = `RekiyaBot/1.0 (+${REPO_URL})`;
const ROBOTS_AGENT = "RekiyaBot";
const MAX_BYTES = 5 * 1024 * 1024;

export interface CacheValidators {
  etag?: string;
  lastModified?: string;
}

export interface FetchRequest {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** Send If-None-Match / If-Modified-Since from these validators. */
  validators?: CacheValidators;
  /** Only for robots.txt itself. */
  skipRobots?: boolean;
}

export interface FetchResult {
  status: number;
  /** Final URL after redirects. */
  url: string;
  headers: Record<string, string>;
  text: string;
  notModified: boolean;
  validators: CacheValidators;
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export interface FetcherOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retries?: number;
  respectRobots?: boolean;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
}

type Robots = ReturnType<typeof robotsParser> | "allow-all" | "disallow-all";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Polite HTTP client: one request at a time per host with a randomised pause
 * between them, robots.txt checked per origin, retries with backoff.
 */
export class PoliteFetcher {
  private readonly hostChains = new Map<string, Promise<unknown>>();
  private readonly robots = new Map<string, Promise<Robots>>();
  private readonly o: Required<Omit<FetcherOptions, "fetchImpl" | "log">>;
  private readonly fetchImpl: typeof fetch;
  private readonly log: (msg: string) => void;
  requests = 0;

  constructor(opts: FetcherOptions = {}) {
    this.o = {
      minDelayMs: opts.minDelayMs ?? 2000,
      maxDelayMs: opts.maxDelayMs ?? 5000,
      timeoutMs: opts.timeoutMs ?? 20000,
      retries: opts.retries ?? 2,
      respectRobots: opts.respectRobots ?? true,
    };
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.log = opts.log ?? (() => {});
  }

  private delay(): number {
    const { minDelayMs: a, maxDelayMs: b } = this.o;
    return a + Math.random() * Math.max(0, b - a);
  }

  /** Run `task` after every earlier task for the same host, then pause. */
  private onHost<T>(host: string, task: () => Promise<T>): Promise<T> {
    const prev = this.hostChains.get(host) ?? Promise.resolve();
    const run = prev.then(task, task);
    this.hostChains.set(
      host,
      run.then(
        () => sleep(this.delay()),
        () => sleep(this.delay()),
      ),
    );
    return run;
  }

  async robotsFor(url: string): Promise<Robots> {
    const origin = new URL(url).origin;
    let p = this.robots.get(origin);
    if (!p) {
      p = this.loadRobots(origin);
      this.robots.set(origin, p);
    }
    return p;
  }

  private async loadRobots(origin: string): Promise<Robots> {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const r = await this.request(robotsUrl, { skipRobots: true });
      // RFC 9309: 4xx → no restrictions; 5xx/unreachable → assume full disallow.
      if (r.status >= 400 && r.status < 500) return "allow-all";
      if (r.status >= 500) return "disallow-all";
      return robotsParser(robotsUrl, r.text);
    } catch (err) {
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) return "allow-all";
      this.log(`robots.txt unreachable for ${origin}: ${(err as Error).message}`);
      return "disallow-all";
    }
  }

  async allowed(url: string): Promise<boolean> {
    if (!this.o.respectRobots) return true;
    const robots = await this.robotsFor(url);
    if (robots === "allow-all") return true;
    if (robots === "disallow-all") return false;
    return robots.isAllowed(url, ROBOTS_AGENT) !== false;
  }

  /** Sitemap URLs declared in robots.txt (empty if none or unavailable). */
  async sitemaps(url: string): Promise<string[]> {
    const robots = await this.robotsFor(url);
    return typeof robots === "string" ? [] : robots.getSitemaps();
  }

  /** Fetch with politeness. Throws RobotsDisallowedError, HttpError (after retries), or network errors. */
  async get(url: string, req: FetchRequest = {}): Promise<FetchResult> {
    if (!req.skipRobots && !(await this.allowed(url))) throw new RobotsDisallowedError(url);
    const r = await this.request(url, req);
    if (r.status >= 400) throw new HttpError(r.status, url);
    return r;
  }

  private request(url: string, req: FetchRequest): Promise<FetchResult> {
    const host = new URL(url).host;
    return this.onHost(host, async () => {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= this.o.retries; attempt++) {
        if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));
        try {
          const r = await this.once(url, req);
          if (r.status === 429 || r.status >= 500) {
            lastErr = new HttpError(r.status, url);
            const ra = Number(r.headers["retry-after"]);
            if (Number.isFinite(ra) && ra > 0 && ra <= 30) await sleep(ra * 1000);
            continue;
          }
          return r;
        } catch (err) {
          lastErr = err;
        }
      }
      if (lastErr instanceof HttpError) {
        return { status: lastErr.status, url, headers: {}, text: "", notModified: false, validators: {} };
      }
      throw lastErr;
    });
  }

  private async once(url: string, req: FetchRequest): Promise<FetchResult> {
    this.requests++;
    const headers: Record<string, string> = {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "en",
      ...req.headers,
    };
    if (req.validators?.etag) headers["if-none-match"] = req.validators.etag;
    if (req.validators?.lastModified) headers["if-modified-since"] = req.validators.lastModified;
    const res = await this.fetchImpl(url, {
      method: req.method ?? "GET",
      headers,
      body: req.body,
      redirect: "follow",
      signal: AbortSignal.timeout(this.o.timeoutMs),
    });
    const outHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (outHeaders[k] = v));
    const validators: CacheValidators = {};
    if (outHeaders.etag) validators.etag = outHeaders.etag;
    if (outHeaders["last-modified"]) validators.lastModified = outHeaders["last-modified"];
    if (res.status === 304) {
      await res.body?.cancel();
      return { status: 304, url: res.url || url, headers: outHeaders, text: "", notModified: true, validators: req.validators ?? {} };
    }
    const text = await readCapped(res, MAX_BYTES);
    return { status: res.status, url: res.url || url, headers: outHeaders, text, notModified: false, validators };
  }
}

async function readCapped(res: Awaited<ReturnType<typeof fetch>>, max: number): Promise<string> {
  if (!res.body) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > max) {
      await res.body.cancel().catch(() => {});
      throw new Error(`response larger than ${max} bytes`);
    }
    chunks.push(chunk);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}
