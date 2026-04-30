"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import twemoji from "@twemoji/api";

const parseSubtree = (node: HTMLElement | Node): void => {
  if (!(node instanceof HTMLElement)) return;
  const tag = node.tagName;
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SCRIPT" ||
    tag === "STYLE"
  ) {
    return;
  }
  twemoji.parse(node, {
    callback: (icon: string) => `/emoji/${icon}.svg`,
    attributes: () => ({
      class: "twemoji",
      draggable: "false",
      loading: "lazy",
    }),
  });
};

export default function TwemojiProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const pathname = usePathname();
  useEffect(() => {
    parseSubtree(document.body);
  }, [pathname]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          // only element nodes can contain text + be parsed
          if (node.nodeType === Node.ELEMENT_NODE) {
            parseSubtree(node as HTMLElement);
          }
          // text nodes added directly: parse the parent
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            parseSubtree(node.parentElement);
          }
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}
