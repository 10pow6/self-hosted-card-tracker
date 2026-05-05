// Shared domain types for the frontend.
// CORE/Binder/Page/Placement mirror the backend schema described in docs/architecture.md.

export type Point = { x: number; y: number };

// ---- Scan flow (real backend) ----

export type Slot = {
  slot_index: number;
  polygon: [Point, Point, Point, Point];
  refined: boolean;
  disabled: boolean; // user marked this pocket as deliberately empty
};

export type PreviewResponse = {
  scan_id: string;
  image_url: string;
  image_size: [number, number];
  bbox: [number, number, number, number];
  rows: number;
  cols: number;
  slots: Slot[];
};

export type RawPreviewResponse = Omit<PreviewResponse, 'slots'> & {
  slots: Array<{
    slot_index: number;
    polygon: [[number, number], [number, number], [number, number], [number, number]];
    refined: boolean;
  }>;
};

export type CommitCropResult = {
  slot_index: number;
  crop_url: string;
  status: 'auto_matched' | 'pending' | 'new_card';
  similarity: number;
  core_card_id: string | null;
};

export type CommitSummary = {
  auto_matched: number;
  pending: number;
  new_cards: number;
  empty: number;
};

export type CommitResponse = {
  scan_id: string;
  page_id: string;
  binder_id: string;
  page_number: number;
  crops: CommitCropResult[];
  empty_slots: number[];
  summary: CommitSummary;
};

// ---- Domain types (mock-backed for now) ----

export type CardType = 'pokemon' | 'sports' | 'other';

export type CoreCard = {
  id: string;
  name: string | null;
  set: string | null;
  number: string | null;
  year: number | null;
  type: CardType;
  notes: string | null;
  representative_crop_url: string;
  embedder_name: string;
  embedder_version: string;
  placement_count: number;
  needs_metadata: boolean;
  created_at: string;
};

export type BinderLayout = string; // "RxC" (e.g. '3x3', '2x2', '4x4'); validated by backend

export type Binder = {
  id: string;
  name: string;
  layout: BinderLayout;
  page_count: number;
  card_count: number;
  cover_thumbs: string[]; // up to 9 representative crop urls for the cover preview
  created_at: string;
};

export type Page = {
  id: string;
  binder_id: string;
  page_number: number;
  source_image_url: string | null;
  placements: Placement[];
};

export type ReviewStatus = 'pending' | 'auto_matched' | 'user_confirmed' | 'new_card' | 'empty';

export type Placement = {
  id: string;
  page_id: string;
  binder_id: string;
  binder_name: string;
  page_number: number;
  slot_index: number;
  crop_url: string | null;
  core_card_id: string | null;
  review_status: ReviewStatus;
};

export type Candidate = {
  core_card: CoreCard;
  similarity: number;
};

export type ReviewQueueItem = {
  placement: Placement;
  candidates: Candidate[];
  deferred_at: string | null; // ISO timestamp; null = active
};

// ---- Settings / model slots ----

export type ModelStatus =
  | 'active'
  | 'available'
  | 'requires-key'
  | 'coming-soon'
  | 'not-configured';

export type ModelOption = {
  id: string;
  name: string;
  description: string;
  version: string | null;
  status: ModelStatus;
  local: boolean;
};

export type AgentConnection = {
  id: string;
  name: string;
  kind: 'mcp' | 'agent' | 'api';
  description: string;
  status: 'configured' | 'available' | 'coming-soon';
};

export type ModelSlotId = 'detection' | 'embeddings' | 'metadata';

export type ModelSlot = {
  id: ModelSlotId;
  title: string;
  description: string;
  active_option_id: string;
  options: ModelOption[];
  // Only populated for the metadata slot — placeholder MCP/agent hooks.
  connections?: AgentConnection[];
};

// ---- Dashboard ----

export type DashboardStats = {
  binders: number;
  pages: number;
  core_cards: number;
  pending_review: number;
};

export type ActivityItem = {
  id: string;
  kind: 'scan' | 'review' | 'enrich' | 'binder';
  title: string;
  detail: string;
  when: string; // ISO
};
