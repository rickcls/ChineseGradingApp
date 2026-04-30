"use client";

import { Children, isValidElement, useMemo, useState, type ReactElement, type ReactNode } from "react";

type HistoryTab = {
  id: string;
  label: string;
};

type SubmissionHistoryTabsProps = {
  items: HistoryTab[];
  children: ReactNode;
};

type HistoryPanel = {
  id: string;
  element: ReactElement<{ ["data-history-view"]?: string }>;
};

export function SubmissionHistoryTabs({ items, children }: SubmissionHistoryTabsProps) {
  const panels = useMemo<HistoryPanel[]>(() => {
    return Children.toArray(children).flatMap((child) => {
      if (!isValidElement<{ ["data-history-view"]?: string }>(child)) return [];
      const id = child.props["data-history-view"];
      return typeof id === "string" && id ? [{ id, element: child }] : [];
    });
  }, [children]);

  const validItems = useMemo(
    () => items.filter((item) => panels.some((panel) => panel.id === item.id)),
    [items, panels],
  );
  const [activeId, setActiveId] = useState(validItems[0]?.id ?? "");

  if (!validItems.length || !panels.length) return null;

  return (
    <div className="space-y-5">
      <div className="paper-panel overflow-hidden px-3 py-3 sm:px-4">
        <div role="tablist" aria-label="作品紀錄檢視" className="flex gap-2 overflow-x-auto pb-1">
          {validItems.map((item) => {
            const isActive = item.id === activeId;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`history-panel-${item.id}`}
                onClick={() => setActiveId(item.id)}
                className={[
                  "nav-pill",
                  isActive ? "nav-pill-active" : "nav-pill-idle",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {panels.map((panel) => {
        const isActive = panel.id === activeId;

        return (
          <div
            key={panel.id}
            id={`history-panel-${panel.id}`}
            role="tabpanel"
            hidden={!isActive}
            className={!isActive ? "hidden" : undefined}
          >
            {panel.element}
          </div>
        );
      })}
    </div>
  );
}
