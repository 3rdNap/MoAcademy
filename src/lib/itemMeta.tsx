import {
  ClipboardList,
  FileText,
  Film,
  Link2,
  MessageSquare,
  Paperclip,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { ModuleItemType } from "@/lib/types";

export const itemIcon: Record<ModuleItemType, LucideIcon> = {
  page: FileText,
  assignment: ClipboardList,
  quiz: HelpCircle,
  discussion: MessageSquare,
  file: Paperclip,
  link: Link2,
  video: Film,
};

export const itemLabel: Record<ModuleItemType, string> = {
  page: "Page",
  assignment: "Assignment",
  quiz: "Quiz",
  discussion: "Discussion",
  file: "File",
  link: "Link",
  video: "Video",
};
