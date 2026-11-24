"use client";

import { useRef, useState, type ReactNode } from "react";

const tabs = ["Pending", "Reviewed", "Manage access"] as const;
type StoreTab = (typeof tabs)[number];

export function StoreTabs({
  pendingCount,
  children,
}: {
  pendingCount: number;
  children: Record<StoreTab, ReactNode>;
}) {
  const [selected, setSelected] = useState(pendingCount ? 0 : 1);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div className="store-tabs">
      <div role="tablist" aria-label="Stores" className="store-tab-list">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            ref={(button) => {
              buttons.current[index] = button;
            }}
            type="button"
            role="tab"
            id={`stores-tab-${index}`}
            aria-selected={selected === index}
            aria-controls={`stores-panel-${index}`}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              let next: number;
              switch (event.key) {
                case "ArrowRight":
                  next = (index + 1) % tabs.length;
                  break;
                case "ArrowLeft":
                  next = (index + tabs.length - 1) % tabs.length;
                  break;
                case "Home":
                  next = 0;
                  break;
                case "End":
                  next = tabs.length - 1;
                  break;
                default:
                  return;
              }
              event.preventDefault();
              setSelected(next);
              buttons.current[next]?.focus();
            }}
          >
            {tab}
            {index === 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab}
          role="tabpanel"
          id={`stores-panel-${index}`}
          aria-labelledby={`stores-tab-${index}`}
          hidden={selected !== index}
          tabIndex={0}
        >
          {children[tab]}
        </div>
      ))}
    </div>
  );
}
