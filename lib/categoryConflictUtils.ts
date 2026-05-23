import type { Contribution } from "@/types/contribution";

export interface ConflictCheck {
  hasConflict: boolean;
  /** Category ID that the group/event already has (or the first new contribution's category) */
  dominantCategoryId: string | null;
  /** New IDs that are compatible with the dominant category */
  compatible: string[];
  /** New IDs that have a different category */
  conflicting: string[];
}

/**
 * Returns the shared category of a set of contributions,
 * or null if they have no category or mixed categories.
 */
export function getEffectiveCategoryId(
  memberIds: string[],
  allContributions: Contribution[]
): string | null {
  const members = allContributions.filter((c) => memberIds.includes(c.id));
  if (members.length === 0) return null;
  const cats = [...new Set(members.map((c) => c.categories[0]).filter(Boolean))];
  return cats.length === 1 ? (cats[0] ?? null) : null;
}

/**
 * Checks whether the new contributions being added conflict with
 * the group/event's existing category.
 *
 * @param newIds        IDs being added
 * @param existingIds   IDs already in the group/event
 * @param allContribs   All contributions available (existing + new)
 */
export function checkCategoryConflict(
  newIds: string[],
  existingIds: string[],
  allContribs: Contribution[]
): ConflictCheck {
  // Determine dominant category from existing members
  const existingCategory = getEffectiveCategoryId(existingIds, allContribs);

  // If no existing members, take dominant from the new set itself (first category found)
  const dominantCategoryId =
    existingCategory ??
    (allContribs.find((c) => newIds.includes(c.id) && c.categories[0])?.categories[0] ?? null);

  if (!dominantCategoryId) {
    // No category context → no conflict
    return { hasConflict: false, dominantCategoryId: null, compatible: newIds, conflicting: [] };
  }

  const compatible = newIds.filter((id) => {
    const c = allContribs.find((c) => c.id === id);
    // OK if no category set, or if matches dominant
    return !c || !c.categories[0] || c.categories[0] === dominantCategoryId;
  });
  const conflicting = newIds.filter((id) => !compatible.includes(id));

  return {
    hasConflict: conflicting.length > 0,
    dominantCategoryId,
    compatible,
    conflicting,
  };
}
