"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api-client";
import { ROLES, UserItem, rotuloRole } from "@/lib/roles";

/**
 * Cadastro de quem acessa os dois sites do ateliê.
 *
 * Fica no menu (e não escondido no Perfil) porque é daqui que saem os logins do
 * site de atendimento: um usuário com a função "Atendimento" entra só no balcão.
 */
export default function UsuariosPage() {
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
  const [aviso, setAviso] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const fetchUsers = useCallback(async () => {
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
  }, [showInativos]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
    else setLoading(false);
  }, [isAdmin, fetchUsers]);

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
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Não foi possível desativar.");
      setDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdId || !novaSenha || novaSenha.length < 6) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/users/${resetPwdId}/reset-password`, { nova_senha: novaSenha });
      setAviso("Senha redefinida.");
      setResetPwdId(null);
      setNovaSenha("");
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
      setResetPwdId(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <Link href="/mobile">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">Usuários</h2>
        </div>
        <p className="text-sm text-gray-500">
          Só administradores podem gerir usuários.
        </p>
      </div>
    );
  }

  const porFuncao = ROLES.map((r) => ({
    ...r,
    lista: users.filter((u) => u.role === r.valor),
  })).filter((g) => g.lista.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-2">
        <Link href="/mobile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">Usuários</h2>
          <p className="text-sm text-gray-500">Quem acessa a gestão e o atendimento</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo
        </Button>
      </div>

      {aviso && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {aviso}
        </p>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showInativos}
          onChange={(e) => setShowInativos(e.target.checked)}
        />
        <span className="text-sm">Mostrar inativos</span>
      </label>

      {/* Agrupado por função: deixa na cara quem entra em qual site. */}
      {porFuncao.map((grupo) => (
        <Card key={grupo.valor}>
          <CardHeader>
            <CardTitle className="text-base">{grupo.rotulo}</CardTitle>
            <CardDescription>{grupo.sub}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {grupo.lista.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{u.nome}</p>
                  <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  {u.ativo === 0 && <span className="text-xs text-gray-400">Inativo</span>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setResetPwdId(u.id)}
                    title="Redefinir senha"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  {u.role !== "admin" && u.ativo === 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(u.id)}
                      className="text-red-600"
                      title="Desativar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {users.length === 0 && (
        <p className="text-sm text-gray-500 py-4">Nenhum usuário cadastrado.</p>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={formNome} onChange={(e) => setFormNome(e.target.value)} required />
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
              <Label htmlFor="password">{editingId ? "Nova senha (opcional)" : "Senha"}</Label>
              <Input
                id="password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                minLength={6}
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
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.rotulo}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {ROLES.find((r) => r.valor === formRole)?.sub}
              </p>
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
            <DialogDescription>Digite a nova senha para o usuário.</DialogDescription>
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
              <Button onClick={handleResetPassword} disabled={saving || novaSenha.length < 6}>
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
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
