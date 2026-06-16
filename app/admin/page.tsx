"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { NavBar } from "@/components/NavBar";
import { RouteGuard } from "@/components/RouteGuard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { PageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { getAllUsers, updateUserRolesAndStatus } from "@/lib/userService";
import {
  subscribeToCategories,
  subscribeToTags,
  createCategory,
  updateCategory,
  deleteCategory,
  createTag,
  deleteTag,
  updateCategoryAccess,
  updateTagCategories,
} from "@/lib/categoryService";
import type { AppUser, UserRole, UserStatus } from "@/types/user";
import type { Group, Tag } from "@/types/contribution";

const PRESET_COLORS = [
  "#EF4444", "#DC2626", "#EC4899", "#DB2777",
  "#F97316", "#EA580C", "#F59E0B", "#D4A843",
  "#22C55E", "#16A34A", "#5A8F4A", "#059669",
  "#0D9488", "#0891B2", "#2563EB", "#4A7A9A",
  "#7C3AED", "#7A5EA0", "#8B5CF6", "#A855F7",
  "#C07830", "#A83030", "#6B9E5E", "#78716C",
];

type EmojiCatKey = "people" | "activities" | "nature" | "food" | "travel" | "culture" | "symbols";

const EMOJI_DATA: { key: EmojiCatKey; emojis: string[] }[] = [
  {
    key: "people",
    emojis: ["👶","🧒","👦","👧","🧑","👱","🧔","👴","👵","👨‍👩‍👧‍👦","👨‍👩‍👦","👨‍👩‍👧","👪","👫","👬","👭","🤝","🙌","🫂","💪"],
  },
  {
    key: "activities",
    emojis: ["⚽","🏀","🏈","⚾","🎾","🏐","🎱","🏓","🏸","🥊","🏋️","🤸","🏊","🚴","🎿","🛷","⛷️","🏂","🎯","🎮","🎲","♟️","🎳","🧩"],
  },
  {
    key: "nature",
    emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐝","🦋","🌸","🌺","🌻","🌹","🍀","🌿","🍃","🌴"],
  },
  {
    key: "food",
    emojis: ["🍕","🍔","🍟","🌮","🌯","🥗","🍣","🍜","🎂","🍰","🧁","🍩","🍪","🍦","🍫","🍷","🍺","☕","🍵","🧃","🥂","🫙","🍱","🥘"],
  },
  {
    key: "travel",
    emojis: ["✈️","🚂","🚢","🚗","🏠","🏡","🏖️","🏔️","⛺","🗺️","🌍","🗼","🏰","⛩️","🎡","🎢","🚀","⛵","🚁","🏕️","🌅","🌄","🗻","🏛️"],
  },
  {
    key: "culture",
    emojis: ["🎨","🖼️","🎭","🎬","🎤","🎵","🎶","🎸","🎹","🥁","📚","📖","📝","✏️","🔬","🔭","🎓","🏛️","⛪","🕌","🎻","🎺","🎷","🎙️"],
  },
  {
    key: "symbols",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","⭐","🌟","💫","✨","🔥","💎","🏆","🥇","🎉","🎊","🎈","🌈","☀️","🌙","⚡","❄️"],
  },
];

const STATUS_COLOR: Record<UserStatus, "amber" | "green" | "red"> = {
  pending: "amber",
  active: "green",
  blocked: "red",
};

const INPUT_CLS =
  "rounded-xl border border-rim bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

type Tab = "pouzivatelia" | "skupiny" | "hashtagy";

function AdminContent() {
  const { appUser } = useAuth();
  const { t, dateFnsLocale } = useI18n();

  const isAdmin = appUser?.roles.includes("admin") ?? false;
  const [tab, setTab] = useState<Tab>(isAdmin ? "pouzivatelia" : "skupiny");

  const [users, setUsers] = useState<AppUser[]>([]);
  const [categories, setCategories] = useState<Group[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [editStatus, setEditStatus] = useState<UserStatus>("active");
  const [userSaving, setUserSaving] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);
  const [catIcon, setCatIcon] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<Group | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState(PRESET_COLORS[0]);
  const [editCatIcon, setEditCatIcon] = useState("");
  const [editCatSaving, setEditCatSaving] = useState(false);

  const [tagName, setTagName] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagAccessUpdating, setTagAccessUpdating] = useState<string | null>(null);

  const [accessUpdating, setAccessUpdating] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "cat" | "tag"; id: string; name: string } | null>(null);

  const contributors = users.filter(
    (u) => u.status === "active" && !u.roles.includes("chronicler") && !u.roles.includes("admin")
  );
  const pending = users.filter((u) => u.status === "pending");

  useEffect(() => {
    getAllUsers().then((all) => { setUsers(all); setLoading(false); });
    const u1 = subscribeToCategories(setCategories);
    const u2 = subscribeToTags(setTags);
    return () => { u1(); u2(); };
  }, []);

  async function reloadUsers() {
    setUsers(await getAllUsers());
  }

  function openEdit(user: AppUser) {
    setEditingUser(user);
    setEditRoles([...user.roles]);
    setEditStatus(user.status);
  }

  function toggleRole(role: UserRole) {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    setUserSaving(true);
    await updateUserRolesAndStatus(editingUser.uid, editRoles, editStatus);
    setUserSaving(false);
    setEditingUser(null);
    reloadUsers();
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim() || !appUser) return;
    setCatSaving(true);
    await createCategory(catName.trim(), catColor, catIcon, appUser.uid);
    setCatName("");
    setCatIcon("");
    setCatSaving(false);
  }

  function openEditCat(cat: Group) {
    setEditingCat(cat);
    setEditCatName(cat.name);
    setEditCatColor(cat.color);
    setEditCatIcon(cat.icon ?? "");
  }

  async function handleSaveCat() {
    if (!editingCat || !editCatName.trim()) return;
    setEditCatSaving(true);
    await updateCategory(editingCat.id, editCatName.trim(), editCatColor, editCatIcon);
    setEditCatSaving(false);
    setEditingCat(null);
  }

  async function toggleTagCategory(tag: Tag, catId: string) {
    const key = tag.id + catId;
    setTagAccessUpdating(key);
    let updated: string[];
    if (catId === "__all__") {
      updated = [];
    } else {
      updated = tag.categoryIds.includes(catId)
        ? tag.categoryIds.filter((id) => id !== catId)
        : [...tag.categoryIds, catId];
    }
    await updateTagCategories(tag.id, updated);
    setTagAccessUpdating(null);
  }

  async function toggleUserAccess(cat: Group, userId: string) {
    const key = cat.id + userId;
    const updated = cat.allowedUserIds.includes(userId)
      ? cat.allowedUserIds.filter((id) => id !== userId)
      : [...cat.allowedUserIds, userId];
    setAccessUpdating(key);
    await updateCategoryAccess(cat.id, updated, appUser ? { uid: appUser.uid, displayName: appUser.displayName, photoURL: appUser.photoURL } : undefined);
    setAccessUpdating(null);
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

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }).sort((a, b) => {
    const order: Record<UserStatus, number> = { pending: 0, active: 1, blocked: 2 };
    return order[a.status] - order[b.status];
  });

  const TABS: { key: Tab; label: string }[] = [
    ...(isAdmin ? [{ key: "pouzivatelia" as Tab, label: t.admin.tabUsers }] : []),
    { key: "skupiny", label: t.admin.tabGroups },
    { key: "hashtagy", label: t.admin.tabHashtags },
  ];

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">{t.admin.title}</h1>
          {isAdmin && pending.length > 0 && tab === "pouzivatelia" && (
            <Badge color="amber">{t.admin.pendingBadge(pending.length)}</Badge>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-surface border border-rim p-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setTab(tabItem.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === tabItem.key
                  ? "bg-gold text-gold-text shadow-sm"
                  : "text-ink-dim hover:text-ink"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* ── Používatelia tab ─────────────────────────────────────────────────── */}
        {tab === "pouzivatelia" && (
          <div className="space-y-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={t.admin.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-rim bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>

            {loading ? (
              <PageSpinner />
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => {
                  const isContributor = user.status === "active" && !user.roles.includes("chronicler") && !user.roles.includes("admin");
                  const isExpanded = expandedUserId === user.uid;
                  const userCats = categories.filter((c) => c.allowedUserIds.includes(user.uid));

                  return (
                    <div key={user.uid} className="rounded-xl border border-rim bg-surface overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3">
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
                            <Badge color={STATUS_COLOR[user.status]}>{t.admin.statusLabels[user.status]}</Badge>
                            {user.roles.map((r) => (
                              <Badge key={r} color="gold">{t.admin.roleLabels[r]}</Badge>
                            ))}
                            {userCats.length > 0 && (
                              <span className="flex items-center gap-1">
                                {userCats.map((cat) => (
                                  <span
                                    key={cat.id}
                                    title={cat.name}
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                        {isContributor && categories.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedUserId(isExpanded ? null : user.uid)}
                            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                              isExpanded
                                ? "bg-gold-dim text-gold"
                                : "border border-rim text-ink-dim hover:bg-surface-high"
                            }`}
                          >
                            {t.admin.groupsBtn}
                          </button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => openEdit(user)}>
                          {t.admin.editBtn}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-rim px-3 py-3 space-y-1 max-h-60 overflow-y-auto">
                          {categories.map((cat) => {
                            const checked = cat.allowedUserIds.includes(user.uid);
                            const key = cat.id + user.uid;
                            return (
                              <label
                                key={cat.id}
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
                                <span
                                  className="h-3 w-3 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                />
                                <p className="flex-1 text-sm text-ink truncate">{cat.name}</p>
                                {accessUpdating === key && (
                                  <span className="text-xs text-ink-subtle shrink-0">…</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <p className="py-10 text-center text-sm text-ink-subtle">{t.admin.noUsers}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Skupiny tab ──────────────────────────────────────────────────────── */}
        {tab === "skupiny" && (
          <div className="space-y-4">
            <form onSubmit={handleAddCategory} className="rounded-xl border border-rim bg-surface p-3 space-y-3">
              <div className="flex gap-2 items-center">
                <input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder={t.admin.groupNamePlaceholder}
                  className={`flex-1 min-w-36 ${INPUT_CLS}`}
                />
                <Button type="submit" size="sm" loading={catSaving} disabled={!catName.trim()}>
                  {t.admin.addBtn}
                </Button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-dim">{t.admin.colorLabel}</label>
                <div className="grid grid-cols-12 gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform ${
                        catColor === c ? "scale-125 ring-2 ring-offset-1 ring-offset-surface ring-ink/40" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-dim">{t.admin.iconLabel}</label>
                <EmojiPicker selected={catIcon} onSelect={setCatIcon} />
              </div>
              {catName && (
                <div className="flex items-center gap-2 pt-0.5">
                  {catIcon ? (
                    <span className="text-base leading-none">{catIcon}</span>
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                  )}
                  <span className="text-sm font-medium" style={{ color: catColor }}>{catName}</span>
                </div>
              )}
            </form>

            <div className="space-y-2">
              {categories.length === 0 && (
                <p className="text-sm text-ink-subtle">{t.admin.noGroups}</p>
              )}
              {categories.map((cat) => {
                const isExpanded = expandedCatId === cat.id;
                const accessCount = cat.allowedUserIds.length;
                return (
                  <div key={cat.id} className="rounded-xl border border-rim bg-surface overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      {cat.icon ? (
                        <span className="shrink-0 text-base leading-none">{cat.icon}</span>
                      ) : (
                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                      )}
                      <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate" style={{ color: cat.color }}>{cat.name}</span>
                      <span className="shrink-0 rounded-full bg-surface-high px-2 py-0.5 text-xs text-ink-subtle">
                        {t.admin.accessCount(accessCount)}
                      </span>
                      <button
                        onClick={() => openEditCat(cat)}
                        className="shrink-0 rounded-lg p-1.5 text-ink-subtle hover:bg-surface-high hover:text-ink"
                        aria-label={t.admin.editBtn}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          isExpanded
                            ? "bg-gold-dim text-gold"
                            : "border border-rim text-ink-dim hover:bg-surface-high"
                        }`}
                      >
                        {t.admin.accessesBtn}
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: "cat", id: cat.id, name: cat.name })}
                        className="shrink-0 rounded-lg p-1.5 text-ink-subtle hover:bg-danger-dim hover:text-danger"
                        aria-label={t.admin.deleteBtn}
                      >
                        <TrashIcon />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-rim px-3 py-3 space-y-1 max-h-60 overflow-y-auto">
                        {contributors.length === 0 ? (
                          <p className="text-xs text-ink-subtle py-2">
                            {t.admin.noActiveContributors}
                          </p>
                        ) : (
                          contributors.map((user) => {
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
          </div>
        )}

        {/* ── Hashtagy tab ─────────────────────────────────────────────────────── */}
        {tab === "hashtagy" && (
          <div className="space-y-4">
            <form onSubmit={handleAddTag} className="flex gap-2">
              <input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="#hashtag"
                className={`flex-1 ${INPUT_CLS}`}
              />
              <Button type="submit" size="sm" loading={tagSaving} disabled={!tagName.trim()}>
                {t.admin.addBtn}
              </Button>
            </form>
            {tags.length === 0 ? (
              <p className="text-sm text-ink-subtle">{t.admin.noHashtags}</p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="rounded-xl border border-rim bg-surface px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium text-gold">{tag.name}</span>
                      <button
                        onClick={() => setDeleteTarget({ type: "tag", id: tag.id, name: tag.name })}
                        className="shrink-0 rounded-lg p-1.5 text-ink-subtle hover:bg-danger-dim hover:text-danger"
                        aria-label={t.admin.deleteBtn}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-xs text-ink-subtle shrink-0">{t.admin.groupsFilterLabel}</span>
                        <button
                          type="button"
                          onClick={() => toggleTagCategory(tag, "__all__")}
                          disabled={tagAccessUpdating === tag.id + "__all__"}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                            tag.categoryIds.length === 0
                              ? "border-gold bg-gold-dim text-gold"
                              : "border-rim text-ink-dim hover:border-rim-strong"
                          }`}
                        >
                          {t.admin.allGroupsLabel}
                        </button>
                        {categories.map((cat) => {
                          const active = tag.categoryIds.includes(cat.id);
                          const key = tag.id + cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleTagCategory(tag, cat.id)}
                              disabled={tagAccessUpdating === key}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                                active
                                  ? "border-transparent text-gold-text"
                                  : "border-rim text-ink-dim hover:border-rim-strong"
                              }`}
                              style={active ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                            >
                              {cat.icon ? cat.icon + " " + cat.name : cat.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit user modal */}
      <Modal
        open={!!editingUser}
        title={t.admin.editUserTitle(editingUser?.displayName ?? "")}
        onClose={() => setEditingUser(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingUser(null)}>{t.admin.cancelBtn}</Button>
            <Button size="sm" loading={userSaving} onClick={handleSaveUser}>{t.admin.saveBtn}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-ink-dim mb-2">{t.admin.accountStatus}</p>
            <div className="flex gap-2">
              {(["pending", "active", "blocked"] as UserStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditStatus(s)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                    editStatus === s
                      ? s === "active"
                        ? "border-success bg-success-dim text-success"
                        : s === "blocked"
                        ? "border-danger bg-danger-dim text-danger"
                        : "border-warning bg-warning-dim text-warning"
                      : "border-rim text-ink-subtle hover:bg-surface"
                  }`}
                >
                  {t.admin.statusLabels[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-dim mb-2">{t.admin.rolesLabel}</p>
            <div className="space-y-2">
              {(["contributor", "chronicler", "admin"] as UserRole[]).map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-3 rounded-xl border border-rim px-3 py-2.5 cursor-pointer hover:bg-surface-high"
                >
                  <input
                    type="checkbox"
                    checked={editRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4 rounded border-rim bg-surface text-gold focus:ring-gold focus:ring-offset-canvas"
                  />
                  <div>
                    <p className="text-sm font-medium text-ink">{t.admin.roleLabels[role]}</p>
                    <p className="text-xs text-ink-subtle">{t.admin.roleDescriptions[role]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {editingUser && (
            <div className="rounded-xl bg-canvas border border-rim px-3 py-2 text-xs text-ink-subtle space-y-0.5">
              <p>{t.admin.uidLabel(editingUser.uid)}</p>
              <p>{t.admin.registeredLabel(format(editingUser.createdAt, "d.M.yyyy", { locale: dateFnsLocale }))}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit category modal */}
      <Modal
        open={editingCat !== null}
        title={t.admin.editGroupTitle}
        onClose={() => setEditingCat(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingCat(null)}>{t.admin.cancelBtn}</Button>
            <Button size="sm" loading={editCatSaving} disabled={!editCatName.trim()} onClick={handleSaveCat}>{t.admin.saveBtn}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-dim">{t.admin.groupNamePlaceholder}</label>
            <input
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && editCatName.trim()) handleSaveCat(); }}
              autoFocus
              className={`w-full ${INPUT_CLS}`}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-ink-dim">{t.admin.colorLabel}</label>
            <div className="grid grid-cols-12 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditCatColor(c)}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    editCatColor === c ? "scale-125 ring-2 ring-offset-1 ring-offset-canvas ring-ink/40" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink-dim">{t.admin.iconLabel}</label>
            <EmojiPicker selected={editCatIcon} onSelect={setEditCatIcon} />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-canvas border border-rim px-3 py-2.5">
            {editCatIcon ? (
              <span className="text-xl leading-none">{editCatIcon}</span>
            ) : (
              <span className="h-5 w-5 rounded-full shrink-0" style={{ backgroundColor: editCatColor }} />
            )}
            <span className="text-sm font-semibold" style={{ color: editCatColor }}>
              {editCatName || t.admin.previewLabel}
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title={t.admin.deleteTitle}
        message={t.admin.deleteConfirm(deleteTarget?.name ?? "")}
        confirmLabel={t.admin.deleteBtn}
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

export default function AdminPage() {
  return (
    <RouteGuard requiredRole={["admin", "chronicler"]}>
      <AdminContent />
    </RouteGuard>
  );
}

function EmojiPicker({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
  const { t } = useI18n();
  const [activeCat, setActiveCat] = useState(0);
  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {EMOJI_DATA.map((cat, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveCat(i)}
            className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors ${
              activeCat === i ? "bg-gold text-gold-text" : "text-ink-dim hover:bg-surface-high"
            }`}
          >
            {t.admin.emojiCategoryLabels[cat.key]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto rounded-lg bg-canvas border border-rim p-1.5">
        <button
          type="button"
          onClick={() => onSelect("")}
          title={t.admin.iconLabel}
          className={`flex items-center justify-center h-8 w-8 rounded-lg text-xs text-ink-subtle transition-colors ${
            !selected ? "bg-gold-dim ring-1 ring-gold" : "hover:bg-surface-high"
          }`}
        >
          ✕
        </button>
        {EMOJI_DATA[activeCat].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className={`flex items-center justify-center h-8 w-8 rounded-lg text-lg leading-none transition-colors ${
              selected === emoji ? "bg-gold-dim ring-1 ring-gold" : "hover:bg-surface-high"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}
