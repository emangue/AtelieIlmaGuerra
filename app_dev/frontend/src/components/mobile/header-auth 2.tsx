"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function HeaderAuth() {
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return (
      <button
        onClick={async () => {
          await logout();
          router.push("/auth/login");
        }}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        Sair
      </button>
    );
  }

  return (
    <Link
      href="/auth/login"
      className="text-sm text-gray-600 hover:text-gray-900"
    >
      Entrar
    </Link>
  );
}
