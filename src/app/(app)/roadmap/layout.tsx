import { Compass } from "lucide-react";
import { RoadmapTabs } from "@/components/roadmap/RoadmapTabs";

export const metadata = { title: "University Roadmap" };

export default function RoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6 overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-6 text-white shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Compass className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              University Roadmap
            </h1>
            <p className="text-sm text-white/85">
              Plan where you want to go, track what it takes to get in, and never
              miss a deadline.
            </p>
          </div>
        </div>
      </div>

      <RoadmapTabs />
      {children}
    </div>
  );
}
