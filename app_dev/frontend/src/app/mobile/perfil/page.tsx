"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, User, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api-client";
import { rotuloRole } from "@/lib/roles";

/** Conta do próprio usuário. O cadastro de quem acessa está em /mobile/usuarios. */
export default function PerfilPage() {

  const { user } = useAuth();

  // troca de senha própria
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenhaNova, setShowSenhaNova] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const handleChangeSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaMsg(null);
    if (senhaNova !== senhaConfirm) {
      setSenhaMsg({ tipo: "erro", texto: "As senhas não coincidem" });
      return;
    }
    if (senhaNova.length < 6) {
      setSenhaMsg({ tipo: "erro", texto: "A nova senha deve ter no mínimo 6 caracteres" });
      return;
    }
    setSalvandoSenha(true);
    try {
      await api.post("/api/v1/users/me/change-password", {
        senha_atual: senhaAtual,
        nova_senha: senhaNova,
      });
      setSenhaMsg({ tipo: "ok", texto: "Senha alterada com sucesso!" });
      setSenhaAtual("");
      setSenhaNova("");
      setSenhaConfirm("");
    } catch (err) {
      setSenhaMsg({ tipo: "erro", texto: err instanceof Error ? err.message : "Erro ao alterar senha" });
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <Link href="/mobile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Perfil</h2>
          <p className="text-sm text-gray-500">Sua conta</p>
        </div>
      </div>

      {/* Meu perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Meu perfil
          </CardTitle>
          <CardDescription>Dados da sessão atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-gray-500">Nome:</span> {user?.nome}
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Email:</span> {user?.email}
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Função:</span>{" "}
              {rotuloRole(user?.role ?? "user")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Alterar senha
          </CardTitle>
          <CardDescription>Defina uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangeSenha} className="space-y-4">
            {senhaMsg && (
              <p className={`text-sm ${senhaMsg.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
                {senhaMsg.texto}
              </p>
            )}
            <div>
              <Label htmlFor="senhaAtual">Senha atual</Label>
              <div className="relative">
                <Input
                  id="senhaAtual"
                  type={showSenhaAtual ? "text" : "password"}
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setShowSenhaAtual((v) => !v)}
                >
                  {showSenhaAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="senhaNova">Nova senha</Label>
              <div className="relative">
                <Input
                  id="senhaNova"
                  type={showSenhaNova ? "text" : "password"}
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                  minLength={6}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setShowSenhaNova((v) => !v)}
                >
                  {showSenhaNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="senhaConfirm">Confirmar nova senha</Label>
              <Input
                id="senhaConfirm"
                type="password"
                value={senhaConfirm}
                onChange={(e) => setSenhaConfirm(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={salvandoSenha}>
              {salvandoSenha && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}
