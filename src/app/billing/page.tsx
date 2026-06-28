import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { getCurrentUser } from "@/lib/data";

export const metadata = { title: "Register · Billing" };

export default async function BillingPage() {
  const user = await getCurrentUser();
  return (
    <BillingDashboard defaultName={user.name} defaultEmail={user.email} />
  );
}
