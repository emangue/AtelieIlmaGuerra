"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Menu,
  X,
  Users,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";

const MENU_ITEMS = [
  {
    href: "/mobile/clientes",
    label: "Clientes",
    sub: "Histórico e contatos",
    Icon: Users,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-700",
  },
  {
    href: "/mobile/contratos",
    label: "Contratos",
    sub: "Modelos e documentos",
    Icon: FileText,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-700",
  },
  {
    href: "/mobile/parametros",
    label: "Parâmetros",
    sub: "Preço/hora, impostos",
    Icon: Settings,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
  },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push("/auth/login");
  };

  const initials = user?.nome
    ? user.nome.split(" ").slice(0, 2).map((p: string) => p[0]).join("").toUpperCase()
    : "IG";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-72 bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center gap-3 bg-[#1F4D35] px-4 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.nome || "Ateliê Ilma Guerra"}
            </p>
            <p className="text-xs text-white/60">Gestão do ateliê</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex flex-col divide-y divide-gray-100">
          {MENU_ITEMS.map(({ href, label, sub, Icon, iconBg, iconColor }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${iconBg}`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              </div>
            </Link>
          ))}

          {/* Sair */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 flex-shrink-0">
              <LogOut className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-600">Sair</p>
          </button>
        </nav>
      </div>
    </>
  );
}
