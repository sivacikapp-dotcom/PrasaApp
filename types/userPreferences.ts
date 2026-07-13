export type SortOrder = "desc" | "asc";
export type TaggedUsersVisibility = "yes" | "no" | "only_me";

export interface ContributionListPrefs {
  defaultSort: SortOrder;
  showLocation: boolean;
  showContributor: boolean;
  showContentTypes: boolean;
  showPhotoPreview: boolean;
  showTaggedUsers: TaggedUsersVisibility;
}

export interface EventListPrefs {
  defaultSort: SortOrder;
  showLastModified: boolean;
  showLocation: boolean;
  showContributionCount: boolean;
  showTaggedUsers: TaggedUsersVisibility;
}

export interface UserPreferences {
  contributions: ContributionListPrefs;
  events: EventListPrefs;
  /** Group IDs preselected by default when creating a new contribution. */
  defaultGroupIds: string[];
  /** Direct event a user's new contributions go into by default, unless changed at entry time. */
  defaultDirectEventId: string | null;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  contributions: {
    defaultSort: "desc",
    showLocation: true,
    showContributor: true,
    showContentTypes: true,
    showPhotoPreview: true,
    showTaggedUsers: "yes",
  },
  events: {
    defaultSort: "desc",
    showLastModified: false,
    showLocation: true,
    showContributionCount: true,
    showTaggedUsers: "yes",
  },
  defaultGroupIds: [],
  defaultDirectEventId: null,
};
