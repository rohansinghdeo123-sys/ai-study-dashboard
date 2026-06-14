"use client";

import { AppIcon, type AppIconName } from "@/components/ui/Polished";

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
    <div className="study-panel-tabs" role="tablist" aria-label="Revision workspaces">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
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
