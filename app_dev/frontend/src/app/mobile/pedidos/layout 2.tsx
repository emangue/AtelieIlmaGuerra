"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ClipboardList, History, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "ativos", label: "Pedidos ativos", icon: ClipboardList, path: "/mobile/pedidos" },
  { id: "historico", label: "Históricos", icon: History, path: "/mobile/pedidos/todos" },
  { id: "orcamentos", label: "Orçamentos ativos", icon: Receipt, path: "/mobile/pedidos/orcamentos" },
];

export default function PedidosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-14 z-40 border-b border-gray-200 bg-white px-2">
        <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              tab.path === "/mobile/pedidos"
                ? pathname === "/mobile/pedidos" || pathname === "/mobile/pedidos/"
                : pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
