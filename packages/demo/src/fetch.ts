import { createDemoApi, type DemoApi, type DemoRequest } from "./api";
import { mountBanner, restoreRedirectedPath } from "./banner";
import type { DemoOptions } from "./types";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function tokenOf(headers: Headers): string | null {
  const value = headers.get("Authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

/**
 * Подменяет глобальный fetch: запросы к apiBase обслуживает встроенный backend (api.ts), остальное — как обычно.
 * Приложения не знают о подмене: они по-прежнему ходят на `${BASE_URL}${path}` и получают те же JSON-ответы и статусы.
 */
export function installDemoApi(options: DemoOptions): DemoApi {
  restoreRedirectedPath();
  const api = createDemoApi(options);
  const original = globalThis.fetch.bind(globalThis);
  const latency = options.latencyMs ?? 120;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(options.apiBase)) return original(input, init);

    const rest = url.slice(options.apiBase.length);
    const [path, search = ""] = rest.split("?");
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    const headers = new Headers(init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined));
    const files: Record<string, File> = {};
    let body: unknown = undefined;
    const raw = init?.body;
    if (typeof FormData !== "undefined" && raw instanceof FormData) {
      raw.forEach((value, key) => {
        if (typeof value !== "string") files[key] = value as File;
      });
    } else if (typeof raw === "string") {
      try {
        body = JSON.parse(raw);
      } catch {
        body = undefined;
      }
    }

    const request: DemoRequest = { method, path, query: new URLSearchParams(search), body, files, token: tokenOf(headers) };
    if (latency > 0) await sleep(latency);
    const { status, data } = await api.handle(request);
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  (globalThis as { __apetiteDemo?: DemoApi }).__apetiteDemo = api;
  if (options.banner) mountBanner(options.banner.app, options.banner.lines, () => api.reset());
  return api;
}
