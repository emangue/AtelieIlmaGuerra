"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, History, PlusCircle, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/clientes", label: "Clientes", icone: Users },
  { href: "/novo", label: "Novo", icone: PlusCircle },
  { href: "/enviados", label: "Enviados", icone: ClipboardList },
  { href: "/historico", label: "Histórico", icone: History },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {ITENS.map(({ href, label, icone: Icone }) => {
          const ativo = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                ativo ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icone className={cn("h-5 w-5", ativo && "stroke-[2.5]")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
