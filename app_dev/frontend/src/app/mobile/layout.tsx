import { BottomNavigation } from "@/components/mobile/bottom-navigation";
import { MobileMenu } from "@/components/mobile/mobile-menu";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">Ateliê Ilma Guerra</h1>
          <p className="text-[10px] text-gray-400 leading-tight">Gestão do ateliê</p>
        </div>
        <MobileMenu />
      </header>
      <main className="min-h-[calc(100vh-4rem)] pt-14">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
