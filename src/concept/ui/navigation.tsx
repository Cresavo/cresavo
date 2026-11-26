"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { cx } from "./cx";

interface Tab {
  id: string;
  label: string;
  panel: ReactNode;
}

export function Tabs({ tabs, value, onChange, label, helpId }: {
  tabs: readonly Tab[]; value: string; onChange: (id: string) => void; label: string;
  /** Help-map id of the tab list. */
  helpId?: string;
}) {
  const groupId = useId();
  return (
    <div>
      <div role="tablist" aria-label={label} data-help-id={helpId} className="flex w-fit max-w-full overflow-x-auto">
        {tabs.map((tab, index) => (
          <button key={tab.id} id={groupId + tab.id} type="button" role="tab" aria-selected={value === tab.id}
            aria-controls={groupId + "-panel-" + tab.id} tabIndex={value === tab.id ? 0 : -1}
            className={cx("min-h-target min-w-target shrink-0 px-3 text-body", value === tab.id && "font-semibold underline underline-offset-4")}
            onClick={() => onChange(tab.id)} onKeyDown={event => {
              const destination: Record<string, number> = {
                Home: 0, End: tabs.length - 1, ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length,
              };
              const next = destination[event.key];
              if (next === undefined) return;
              event.preventDefault();
              event.currentTarget.parentElement?.querySelectorAll("button")[next]?.focus();
              onChange(tabs[next].id);
            }}>{tab.label}</button>
        ))}
      </div>
      {tabs.map(tab => <div key={tab.id} id={groupId + "-panel-" + tab.id} role="tabpanel" aria-labelledby={groupId + tab.id}
        hidden={value !== tab.id} tabIndex={0} className="p-3">{tab.panel}</div>)}
    </div>
  );
}

/** In-flow disclosure of navigation links. Native summary handles keyboard and touch. */
export function Menu({ label, links }: { label: string; links: readonly { href: string; label: string }[] }) {
  return <details>
    <summary className="min-h-target cursor-pointer px-3 py-3 text-body font-medium">{label}</summary>
    <ul className="pl-4">{links.map(link => <li key={link.href}>
      <Link href={link.href} className="inline-flex min-h-target items-center px-3 underline">{link.label}</Link>
    </li>)}</ul>
  </details>;
}
