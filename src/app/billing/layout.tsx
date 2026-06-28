import { PageHeader } from "@/components/ui/PageHeader";
import { BillingTabs } from "@/components/billing/BillingTabs";

export const metadata = { title: "Billing" };

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader
        title="Billing & Registration"
        subtitle="Choose your subjects — the more you register, the less you pay per subject."
      />
      <BillingTabs />
      {children}
    </div>
  );
}
