"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Triggers the browser print dialog; hidden in the printed output itself. */
export function PrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="h-4 w-4" />
      Print
    </Button>
  );
}
