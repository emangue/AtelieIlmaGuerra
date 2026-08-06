"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

export function AppHeader() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const sair = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">Atendimento</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {user ? user.nome : "Ateliê Ilma Guerra"}
        </p>
      </div>
      <button
        type="button"
        onClick={sair}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </header>
  );
}
