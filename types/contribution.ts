export type ContributionStatus = "pending" | "processed";

export interface VoiceNote {
  url: string;
  transcript: string | null;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface Contribution {
  id: string;
  // Contributor info
  contributorId: string;
  contributorName: string;
  // Contributor-provided content
  eventDate: Date;
  texts: string[];
  photoUrls: string[];
  videoUrls: string[];
  voices: VoiceNote[];
  // Auto-captured metadata
  recordedAt: Date;
  location: GeoLocation | null;
  locationName: string | null;
  // Chronicler additions
  verifiedEventDate: Date | null;
  chroniclerText: string | null;
  chroniclerVoiceUrl: string | null;
  chroniclerPhotoUrls: string[];
  chroniclerVoiceTranscript: string | null;
  categories: string[];   // Category IDs
  hashtags: string[];     // Tag IDs
  // Merge — many-to-many: a contribution can belong to multiple groups
  eventGroupIds: string[];
  status: ContributionStatus;
  // Access control: union of contributorId + allowedUserIds of assigned category
  visibleToIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  allowedUserIds: string[];
  createdBy: string;
  createdAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  /** Category IDs this tag is restricted to. Empty = available in all groups. */
  categoryIds: string[];
  createdBy: string;
  createdAt: Date;
}

// Simple grouping container — only has a name
export interface EventGroup {
  id: string;
  title: string;
  contributionIds: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chronicle event — compiled summary from contributions + chronicler metadata
// Named ChronicleEvent to avoid collision with the DOM global Event type
export interface ChronicleEvent {
  id: string;
  title: string;
  locationName: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  description: string | null;
  contributionIds: string[];
  // Manual display order of entity keys (e.g. "id:text", "id:photos"); [] = fall back to default
  entityOrder: string[];
  categoryId: string | null;
  hiddenItems: string[];
  categories: string[];
  hashtags: string[];
  editorIds: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
