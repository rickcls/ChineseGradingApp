"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

type SubmissionSectionItem = {
  id: string;
  label: string;
};

type SubmissionSectionTabsProps = {
  items: SubmissionSectionItem[];
  children: ReactNode;
  defaultSectionId?: string;
};

type SectionPanel = {
  id: string;
  element: ReactElement<{ ["data-section-id"]?: string }>;
};

export function SubmissionSectionTabs({
  items,
  children,
  defaultSectionId,
}: SubmissionSectionTabsProps) {
  const panels = useMemo<SectionPanel[]>(() => {
    return Children.toArray(children).flatMap((child) => {
      if (!isValidElement<{ ["data-section-id"]?: string }>(child)) return [];
      const id = child.props["data-section-id"];
      return typeof id === "string" && id ? [{ id, element: child }] : [];
    });
  }, [children]);

  const validItems = useMemo(
    () => items.filter((item) => panels.some((panel) => panel.id === item.id)),
    [items, panels],
  );

  const [activeId, setActiveId] = useState(() => {
    if (defaultSectionId && validItems.some((item) => item.id === defaultSectionId)) {
      return defaultSectionId;
    }
    return validItems[0]?.id ?? "";
  });

  useEffect(() => {
    if (validItems.some((item) => item.id === activeId)) return;
    setActiveId(defaultSectionId && validItems.some((item) => item.id === defaultSectionId) ? defaultSectionId : (validItems[0]?.id ?? ""));
  }, [activeId, defaultSectionId, validItems]);

  if (validItems.length === 0 || panels.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="sticky top-[5.25rem] z-30">
        <div className="paper-panel overflow-hidden px-3 py-3 sm:px-4">
          <div role="tablist" aria-label="文章分區" className="flex gap-2 overflow-x-auto pb-1">
            {validItems.map((item) => {
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  id={`tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setActiveId(item.id)}
                  className={[
                    "shrink-0 rounded-full px-4 py-2 text-sm transition",
                    isActive
                      ? "bg-accent text-white shadow-soft"
                      : "border border-border/80 bg-white/85 text-ink/75 hover:border-accent/30 hover:text-accent",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {panels.map((panel) => {
          const isActive = panel.id === activeId;

          return (
            <div
              key={panel.id}
              id={`panel-${panel.id}`}
              role="tabpanel"
              aria-labelledby={`tab-${panel.id}`}
              hidden={!isActive}
              className={!isActive ? "hidden" : undefined}
            >
              {panel.element}
            </div>
          );
        })}
      </div>
    </div>
  );
}
