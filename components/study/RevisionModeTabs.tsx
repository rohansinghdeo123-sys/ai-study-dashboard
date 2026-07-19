"use client";

import { AppIcon, type AppIconName } from "@/components/ui/Polished";
import { handleTabListKeyDown } from "@/components/ui/primitives";

export type RevisionWorkspaceId = "summary" | "explain" | "keypoints" | "artifact";

const TABS: Array<{ id: RevisionWorkspaceId; label: string; icon: AppIconName }> = [
  { id: "summary", label: "Summary", icon: "book" },
  { id: "explain", label: "Deep Dive", icon: "study" },
  { id: "keypoints", label: "Quick Recall", icon: "copy" },
  { id: "artifact", label: "Study Tools", icon: "mission" },
];

export default function RevisionModeTabs({
  activeTab,
  onChange,
}: {
  activeTab: RevisionWorkspaceId;
  onChange: (tab: RevisionWorkspaceId) => void;
}) {
  return (
    <div className="study-panel-tabs" role="tablist" aria-label="Revision workspaces" onKeyDown={handleTabListKeyDown}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`revision-tab-${tab.id}`}
          aria-controls={`revision-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={`study-panel-tab ${activeTab === tab.id ? "is-active" : ""}`}
        >
          <AppIcon name={tab.icon} className="h-4 w-4" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
