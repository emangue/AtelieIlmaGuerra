"use client";

import React, { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, User, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api-client";


interface UserItem {
  id: number;
  email: string;
  nome: string;
  role: string;
  ativo: number;
}

export default function PerfilPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInativos, setShowInativos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [resetPwdId, setResetPwdId] = useState<number | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [novaSenha, setNovaSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // troca de senha própria
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenhaNova, setShowSenhaNova] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchUsers = async () => {
    try {
      const res = await api.get<{ users: UserItem[]; total: number }>(
        `/api/v1/users?apenas_ativos=${!showInativos}`
      );
      setUsers(res.users);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [isAdmin, showInativos]);

  const openNew = () => {
    setEditingId(null);
    setFormNome("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("user");
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (u: UserItem) => {
    setEditingId(u.id);
    setFormNome(u.nome);
    setFormEmail(u.email);
    setFormPassword("");
    setFormRole(u.role);
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingId) {
        const body: Record<string, unknown> = { nome: formNome, email: formEmail, role: formRole };
        if (formPassword) body.password = formPassword;
        await api.patch(`/api/v1/users/${editingId}`, body);
      } else {
        if (!formPassword || formPassword.length < 6) {
          setError("Senha deve ter no mínimo 6 caracteres");
          return;
        }
        await api.post("/api/v1/users", {
          nome: formNome,
          email: formEmail,
          password: formPassword,
          role: formRole,
        });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await api.delete(`/api/v1/users/${deleteId}`);
      setDeleteId(null);
      fetchUsers();
    } catch {
      setDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdId || !novaSenha || novaSenha.length < 6) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/users/${resetPwdId}/reset-password`, {
        nova_senha: novaSenha,
      });
      setResetPwdId(null);
      setNovaSenha("");
    } catch {
      setResetPwdId(null);
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

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
          <p className="text-sm text-gray-500">
            {isAdmin ? "Gestão de usuários e sua conta" : "Sua conta"}
          </p>
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
              {user?.role === "admin" ? "Administrador" : "Usuário"}
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

      {/* Gestão de usuários (só admin) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>Gerir contas do sistema</CardDescription>
              </div>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInativos}
                onChange={(e) => setShowInativos(e.target.checked)}
              />
              <span className="text-sm">Mostrar inativos</span>
            </label>
            <div className="mt-4 space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div>
                    <p className="font-medium text-gray-900">{u.nome}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <span className="text-xs text-gray-400">
                      {u.role === "admin" ? "Admin" : "Usuário"}
                      {u.ativo === 0 ? " • Inativo" : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(u)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setResetPwdId(u.id)}
                      title="Redefinir senha"
                    >
                      <span className="text-xs">🔑</span>
                    </Button>
                    {u.role !== "admin" && u.ativo === 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(u.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-gray-500 py-4">Nenhum usuário cadastrado.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Novo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Altere os dados. Deixe a senha em branco para manter."
                : "Preencha os dados do novo usuário."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">
                {editingId ? "Nova senha (opcional)" : "Senha"}
              </Label>
              <Input
                id="password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                minLength={6}
                disabled={!!editingId && !formPassword}
              />
            </div>
            <div>
              <Label htmlFor="role">Função</Label>
              <select
                id="role"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Redefinir senha */}
      <Dialog open={!!resetPwdId} onOpenChange={() => setResetPwdId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Digite a nova senha para o usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="novaSenha">Nova senha</Label>
              <Input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                minLength={6}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPwdId(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={saving || novaSenha.length < 6}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Redefinir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário será desativado e não poderá mais acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
