import { PageHeader } from "@/components/ui/PageHeader";
import { BillingDashboard } from "@/components/billing/BillingDashboard";

export const metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing & Registration"
        subtitle="Choose your subjects — the more you register, the less you pay per subject."
      />
      <BillingDashboard />
    </>
  );
}
