declare global {
  interface Window {
    __TABLE_KEEPER_BASE_PATH__?: string;
  }
}

const URL_ATTRIBUTES = ["href", "src", "srcset"] as const;

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
      element.setAttribute(
        attribute,
        value
          .split(",")
          .map((candidate) => {
            const [url, ...descriptor] = candidate.trim().split(/\s+/);
            return [rewriteUrl(url, basePath), ...descriptor].join(" ");
          })
          .join(", "),
      );
    } else {
      element.setAttribute(attribute, rewriteUrl(value, basePath));
    }
  }
}

export function installBasePathAdapter(): void {
  const basePath = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  window.__TABLE_KEEPER_BASE_PATH__ = basePath === "/" ? "" : basePath;
  if (basePath === "/") return;

  document.querySelectorAll("[href], [src], [srcset]").forEach((element) => {
    rewriteElement(element, basePath);
  });

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") rewriteElement(record.target as Element, basePath);
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        rewriteElement(node, basePath);
        node.querySelectorAll("[href], [src], [srcset]").forEach((element) => {
          rewriteElement(element, basePath);
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
