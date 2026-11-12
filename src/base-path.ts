declare global {
  interface Window {
    __TABLE_KEEPER_BASE_PATH__?: string;
  }
}

const URL_ATTRIBUTES = ["href", "src", "srcset"] as const;

function basePath(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

function rewriteUrl(value: string, basePath: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith(basePath)) {
    return value;
  }
  return `${basePath}${value.slice(1)}`;
}

function rewriteElement(element: Element, basePath: string): void {
  for (const attribute of URL_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    if (attribute === "srcset") {
      const rewritten = value
        .split(",")
        .map((candidate) => {
          const [url, ...descriptor] = candidate.trim().split(/\s+/);
          return [rewriteUrl(url, basePath), ...descriptor].join(" ");
        })
        .join(", ");
      if (rewritten !== value) element.setAttribute(attribute, rewritten);
    } else {
      const rewritten = rewriteUrl(value, basePath);
      if (rewritten !== value) element.setAttribute(attribute, rewritten);
    }
  }
}

function rewriteDataUrl(value: string | URL, basePath: string): string | URL {
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/data/")) {
    return value;
  }
  url.pathname = `${basePath}${url.pathname.slice(1)}`;
  return typeof value === "string" ? url.href : url;
}

function installDataFetchAdapter(basePath: string): void {
  if (basePath === "/") return;

  const nativeFetch = window.fetch.bind(window);
  // The imported v4 bundles request rules from /data/*.json. Restrict this
  // compatibility adapter to those same-origin requests so API and third-party
  // traffic retain the browser's native fetch behavior.
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) {
      const rewritten = rewriteDataUrl(input.url, basePath);
      return nativeFetch(
        rewritten === input.url ? input : new Request(rewritten, input),
        init,
      );
    }
    return nativeFetch(rewriteDataUrl(input, basePath), init);
  };
}

export function installBasePathAdapter(): void {
  const configuredBasePath = basePath();
  window.__TABLE_KEEPER_BASE_PATH__ = configuredBasePath === "/" ? "" : configuredBasePath;
  installDataFetchAdapter(configuredBasePath);
  if (configuredBasePath === "/") return;

  document.querySelectorAll("[href], [src], [srcset]").forEach((element) => {
    rewriteElement(element, configuredBasePath);
  });

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        rewriteElement(record.target as Element, configuredBasePath);
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        rewriteElement(node, configuredBasePath);
        node.querySelectorAll("[href], [src], [srcset]").forEach((element) => {
          rewriteElement(element, configuredBasePath);
        });
      }
    }
  }).observe(document.documentElement, {
    attributeFilter: [...URL_ATTRIBUTES],
    attributes: true,
    childList: true,
    subtree: true,
  });
}
