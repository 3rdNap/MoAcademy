import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const metadata = { title: "Study Assistant" };

export default function AssistantPage() {
  // Suspense boundary for useSearchParams (?course=… deep links).
  return (
    <Suspense>
      <AssistantChat />
    </Suspense>
  );
}
