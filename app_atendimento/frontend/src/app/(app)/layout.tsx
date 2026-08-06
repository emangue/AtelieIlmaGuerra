import { AppHeader } from "@/components/atendimento/app-header";
import { BottomNavigation } from "@/components/atendimento/bottom-navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-18">{children}</main>
      {/* pt-18 = 4.5rem: header fixo tem 3.5rem + respiro */}
      <BottomNavigation />
    </div>
  );
}
