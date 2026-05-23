"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToCategories,
  subscribeToTags,
  createCategory,
  deleteCategory,
  createTag,
  deleteTag,
  updateCategoryAccess,
} from "@/lib/categoryService";
import { getAllUsers } from "@/lib/userService";
import type { Category, Tag } from "@/types/contribution";
import type { AppUser } from "@/types/user";

const PRESET_COLORS = [
  "#D4A843", "#C07830", "#A83030", "#5A8F4A",
  "#4A7A9A", "#7A5EA0", "#C05880", "#6B9E5E",
];

const INPUT_CLS =
  "rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function CategoriesContent() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);
  const [catSaving, setCatSaving] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "cat" | "tag"; id: string; name: string } | null>(null);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [accessUpdating, setAccessUpdating] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeToCategories(setCategories);
    const u2 = subscribeToTags(setTags);
    getAllUsers().then((all) =>
      setUsers(all.filter((u) => u.status === "active" && !u.roles.includes("chronicler") && !u.roles.includes("admin")))
    );
    return () => { u1(); u2(); };
  }, []);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim() || !appUser) return;
    setCatSaving(true);
    await createCategory(catName.trim(), catColor, appUser.uid);
    setCatName("");
    setCatSaving(false);
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!tagName.trim() || !appUser) return;
    setTagSaving(true);
    await createTag(tagName.trim(), appUser.uid);
    setTagName("");
    setTagSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "cat") await deleteCategory(deleteTarget.id);
    else await deleteTag(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function toggleUserAccess(cat: Category, userId: string) {
    const key = cat.id + userId;
    const updated = cat.allowedUserIds.includes(userId)
      ? cat.allowedUserIds.filter((id) => id !== userId)
      : [...cat.allowedUserIds, userId];
    setAccessUpdating(key);
    await updateCategoryAccess(cat.id, updated);
    setAccessUpdating(null);
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-xl px-4 py-6 space-y-8">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-ink-subtle hover:text-ink-dim">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-ink">Kategórie & Hashtagy</h1>
        </div>

        {/* ── Categories ──────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-ink-dim">Kategórie</h2>

          <form onSubmit={handleAddCategory} className="flex gap-2 flex-wrap items-center">
            <input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Názov kategórie"
              className={`flex-1 min-w-36 ${INPUT_CLS}`}
            />
            <div className="flex gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform ${catColor === c ? "scale-125 ring-2 ring-offset-2 ring-offset-canvas ring-ink/40" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button type="submit" size="sm" loading={catSaving} disabled={!catName.trim()}>
              Pridať
            </Button>
          </form>

          <div className="space-y-2">
            {categories.length === 0 && (
              <p className="text-sm text-ink-subtle">Zatiaľ žiadne kategórie.</p>
            )}
            {categories.map((cat) => {
              const isExpanded = expandedCatId === cat.id;
              const accessCount = cat.allowedUserIds.length;
              return (
                <div key={cat.id} className="rounded-xl border border-rim bg-surface overflow-hidden">
                  {/* Row */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">
                      {cat.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-high px-2 py-0.5 text-xs text-ink-subtle">
                      {accessCount === 0
                        ? "Nikto"
                        : accessCount === 1
                        ? "1 používateľ"
                        : `${accessCount} používatelia`}
                    </span>
                    <button
                      onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        isExpanded
                          ? "bg-gold-dim text-gold"
                          : "border border-rim text-ink-dim hover:bg-surface-high"
                      }`}
                    >
                      Prístupy
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "cat", id: cat.id, name: cat.name })}
                      className="shrink-0 rounded-lg p-1.5 text-ink-subtle hover:bg-danger-dim hover:text-danger"
                      aria-label="Odstrániť"
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  {/* Access panel */}
                  {isExpanded && (
                    <div className="border-t border-rim px-3 py-3 space-y-1 max-h-60 overflow-y-auto">
                      {users.length === 0 ? (
                        <p className="text-xs text-ink-subtle py-2">
                          Žiadni aktívni prispievatelia. Najprv schváľte používateľov v sekcii Správa.
                        </p>
                      ) : (
                        users.map((user) => {
                          const checked = cat.allowedUserIds.includes(user.uid);
                          const key = cat.id + user.uid;
                          return (
                            <label
                              key={user.uid}
                              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                                checked ? "bg-gold-dim" : "hover:bg-surface-high"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={accessUpdating === key}
                                onChange={() => toggleUserAccess(cat, user.uid)}
                                className="sr-only"
                              />
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  checked ? "border-gold bg-gold" : "border-rim-strong bg-surface"
                                }`}
                              >
                                {checked && (
                                  <svg className="h-2.5 w-2.5 text-gold-text" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                                    <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                                  </svg>
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-ink truncate">{user.displayName || user.email}</p>
                                <p className="text-xs text-ink-subtle truncate">{user.email}</p>
                              </div>
                              {accessUpdating === key && (
                                <span className="text-xs text-ink-subtle shrink-0">…</span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Tags ────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-ink-dim">Hashtagy</h2>
          <form onSubmit={handleAddTag} className="flex gap-2">
            <input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="#hashtag"
              className={`flex-1 ${INPUT_CLS}`}
            />
            <Button type="submit" size="sm" loading={tagSaving} disabled={!tagName.trim()}>
              Pridať
            </Button>
          </form>
          <div className="flex flex-wrap gap-2 min-h-8">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1 rounded-full bg-gold-dim border border-gold/30 pl-2.5 pr-1.5 py-1"
              >
                <span className="text-sm text-gold">{tag.name}</span>
                <button
                  onClick={() => setDeleteTarget({ type: "tag", id: tag.id, name: tag.name })}
                  className="rounded-full p-0.5 text-gold/50 hover:text-gold"
                  aria-label="Odstrániť"
                >
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 4.586L2.707 1.293 1.293 2.707 4.586 6 1.293 9.293l1.414 1.414L6 7.414l3.293 3.293 1.414-1.414L7.414 6l3.293-3.293L9.293 1.293z" />
                  </svg>
                </button>
              </div>
            ))}
            {tags.length === 0 && <p className="text-sm text-ink-subtle">Zatiaľ žiadne hashtagy.</p>}
          </div>
        </section>
      </main>

      <ConfirmModal
        open={!!deleteTarget}
        title="Odstrániť"
        message={`Naozaj chcete odstrániť "${deleteTarget?.name}"?`}
        confirmLabel="Odstrániť"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

export default function CategoriesPage() {
  return <RouteGuard requiredRole="chronicler"><CategoriesContent /></RouteGuard>;
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}
