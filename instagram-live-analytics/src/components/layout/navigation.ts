import {
  Activity,
  BarChart3,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Lightbulb,
  MessageSquareText,
  Scissors,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PageId =
  | "overview"
  | "monitor"
  | "audience"
  | "comments"
  | "guests"
  | "engagement"
  | "clips"
  | "previous"
  | "compare"
  | "insights"
  | "settings";

export const NAV: { id: PageId; label: string; icon: LucideIcon; group: "live" | "history" | "app" }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "live" },
  { id: "monitor", label: "Live Monitor", icon: Activity, group: "live" },
  { id: "audience", label: "Audience", icon: Users, group: "live" },
  { id: "comments", label: "Comments", icon: MessageSquareText, group: "live" },
  { id: "guests", label: "Guests", icon: UserPlus, group: "live" },
  { id: "engagement", label: "Engagement", icon: Sparkles, group: "live" },
  { id: "clips", label: "Clip Opportunities", icon: Scissors, group: "live" },
  { id: "previous", label: "Previous Lives", icon: History, group: "history" },
  { id: "compare", label: "Comparisons", icon: GitCompareArrows, group: "history" },
  { id: "insights", label: "Insights", icon: Lightbulb, group: "history" },
  { id: "settings", label: "Settings", icon: Settings, group: "app" },
];

export const PAGE_ICON_FALLBACK = BarChart3;
