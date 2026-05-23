"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { PageSpinner } from "@/components/ui/Spinner";
import { getAllUsers, updateUserRolesAndStatus } from "@/lib/userService";
import type { AppUser, UserRole, UserStatus } from "@/types/user";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Správca",
  chronicler: "Kronikár",
  contributor: "Prispievateľ",
};

const STATUS_COLOR: Record<UserStatus, "amber" | "green" | "red"> = {
  pending: "amber",
  active: "green",
  blocked: "red",
};

const STATUS_LABEL: Record<UserStatus, string> = {
  pending: "Čaká",
  active: "Aktívny",
  blocked: "Blokovaný",
};

function AdminContent() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [editStatus, setEditStatus] = useState<UserStatus>("active");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  async function reload() {
    setLoading(true);
    setUsers(await getAllUsers());
    setLoading(false);
  }
  useEffect(() => { reload(); }, []);

  function openEdit(user: AppUser) {
    setEditingUser(user);
    setEditRoles([...user.roles]);
    setEditStatus(user.status);
  }

  function toggleRole(role: UserRole) {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  async function handleSave() {
    if (!editingUser) return;
    setSaving(true);
    await updateUserRolesAndStatus(editingUser.uid, editRoles, editStatus);
    setSaving(false);
    setEditingUser(null);
    reload();
  }

  const pending = users.filter((u) => u.status === "pending");
  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }).sort((a, b) => {
    const order: Record<UserStatus, number> = { pending: 0, active: 1, blocked: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">Správa užívateľov</h1>
          {pending.length > 0 && (
            <Badge color="amber">{pending.length} čaká na schválenie</Badge>
          )}
        </div>

        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Hľadať podľa mena alebo emailu…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-rim bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
        </div>

        {loading ? (
          <PageSpinner />
        ) : (
          <div className="space-y-2">
            {filtered.map((user) => (
              <div key={user.uid}
                className="flex items-center gap-3 rounded-xl border border-rim bg-surface px-4 py-3">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full ring-1 ring-rim shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gold-dim flex items-center justify-center text-sm font-semibold text-gold shrink-0">
                    {user.displayName?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{user.displayName || "—"}</p>
                  <p className="text-xs text-ink-subtle truncate">{user.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge color={STATUS_COLOR[user.status]}>{STATUS_LABEL[user.status]}</Badge>
                    {user.roles.map((r) => (
                      <Badge key={r} color="gold">{ROLE_LABELS[r]}</Badge>
                    ))}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openEdit(user)}>Upraviť</Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-ink-subtle">Žiadni užívatelia.</p>
            )}
          </div>
        )}
      </main>

      <Modal open={!!editingUser} title={`Upraviť: ${editingUser?.displayName}`}
        onClose={() => setEditingUser(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingUser(null)}>Zrušiť</Button>
            <Button size="sm" loading={saving} onClick={handleSave}>Uložiť</Button>
          </>
        }>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-ink-dim mb-2">Stav účtu</p>
            <div className="flex gap-2">
              {(["pending", "active", "blocked"] as UserStatus[]).map((s) => (
                <button key={s} type="button" onClick={() => setEditStatus(s)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                    editStatus === s
                      ? s === "active"
                        ? "border-success bg-success-dim text-success"
                        : s === "blocked"
                        ? "border-danger bg-danger-dim text-danger"
                        : "border-warning bg-warning-dim text-warning"
                      : "border-rim text-ink-subtle hover:bg-surface"
                  }`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-dim mb-2">Role</p>
            <div className="space-y-2">
              {(["contributor", "chronicler", "admin"] as UserRole[]).map((role) => (
                <label key={role} className="flex items-center gap-3 rounded-xl border border-rim px-3 py-2.5 cursor-pointer hover:bg-surface-high">
                  <input type="checkbox" checked={editRoles.includes(role)} onChange={() => toggleRole(role)}
                    className="h-4 w-4 rounded border-rim bg-surface text-gold focus:ring-gold focus:ring-offset-canvas" />
                  <div>
                    <p className="text-sm font-medium text-ink">{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-ink-subtle">
                      {role === "contributor" && "Pridáva príspevky"}
                      {role === "chronicler" && "Spracováva a edituje príspevky"}
                      {role === "admin" && "Spravuje užívateľov"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {editingUser && (
            <div className="rounded-xl bg-canvas border border-rim px-3 py-2 text-xs text-ink-subtle space-y-0.5">
              <p>UID: {editingUser.uid}</p>
              <p>Registrovaný: {format(editingUser.createdAt, "d.M.yyyy", { locale: sk })}</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

export default function AdminPage() {
  return <RouteGuard requiredRole="admin"><AdminContent /></RouteGuard>;
}
