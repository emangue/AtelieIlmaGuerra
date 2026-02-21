import Link from "next/link";
import { BottomNavigation } from "@/components/mobile/bottom-navigation";
import { HeaderAuth } from "@/components/mobile/header-auth";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header fixo no topo - sempre visível ao rolar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Ateliê Ilma Guerra</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/mobile/clientes"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clientes
          </Link>
          <Link
            href="/mobile/parametros"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Parâmetros
          </Link>
          <Link
            href="/mobile/perfil"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Perfil
          </Link>
          <HeaderAuth />
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)] pt-14">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
