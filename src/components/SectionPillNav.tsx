"use client";

import { useEffect, useMemo, useState } from "react";

type SectionItem = {
  id: string;
  label: string;
};

type SectionPillNavProps = {
  items: SectionItem[];
};

export function SectionPillNav({ items }: SectionPillNavProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  const validItems = useMemo(() => items.filter((item) => item.id && item.label), [items]);

  useEffect(() => {
    if (!validItems.length) return;

    const observers: IntersectionObserver[] = [];

    for (const item of validItems) {
      const element = document.getElementById(item.id);
      if (!element) continue;

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.find((entry) => entry.isIntersecting);
          if (visible) {
            setActiveId(item.id);
          }
        },
        {
          rootMargin: "-25% 0px -55% 0px",
          threshold: [0.15, 0.35, 0.6],
        },
      );

      observer.observe(element);
      observers.push(observer);
    }

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [validItems]);

  function jumpTo(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    setActiveId(id);
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (validItems.length === 0) return null;

  return (
    <div className="sticky top-[5.25rem] z-30 -mt-2">
      <div className="paper-panel overflow-hidden px-3 py-3 sm:px-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {validItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpTo(item.id)}
              className={[
                "nav-pill",
                activeId === item.id ? "nav-pill-active" : "nav-pill-idle",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
