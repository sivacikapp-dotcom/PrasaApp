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
};
