import { AuthCard } from "@/components/auth/AuthCard";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return <AuthCard mode="signin" />;
}
