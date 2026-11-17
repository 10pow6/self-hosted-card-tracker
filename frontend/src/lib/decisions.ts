// Decision-provenance vocabulary (DESIGN.md · Colors).
// Violet = model output, green = human-confirmed, amber = awaiting judgment,
// blue = system event. Every AI-derived value in the UI carries one of these.

import type { MetadataSource, ReviewStatus } from '@/api/types';

export type DecisionTone = 'ai' | 'success' | 'warning' | 'info' | 'muted' | 'destructive';

// Literal class strings so Tailwind can see them.
export const TONE_CLASSES: Record<DecisionTone, { chip: string; dot: string; text: string; border: string }> = {
  ai: { chip: 'bg-ai/15 text-ai', dot: 'bg-ai', text: 'text-ai', border: 'border-ai/40' },
  success: { chip: 'bg-success/15 text-success', dot: 'bg-success', text: 'text-success', border: 'border-success/40' },
  warning: { chip: 'bg-warning/15 text-warning', dot: 'bg-warning', text: 'text-warning', border: 'border-warning/40' },
  info: { chip: 'bg-info/15 text-info', dot: 'bg-info', text: 'text-info', border: 'border-info/40' },
  muted: { chip: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', text: 'text-muted-foreground', border: 'border-border' },
  destructive: { chip: 'bg-destructive/15 text-destructive', dot: 'bg-destructive', text: 'text-destructive', border: 'border-destructive/40' },
};

export type ReviewStatusMeta = {
  label: string;
  tone: DecisionTone;
  // One sentence answering "who decided this?" — shown in tooltips.
  whoDecided: string;
};

export const REVIEW_STATUS_META: Record<ReviewStatus, ReviewStatusMeta> = {
  pending: {
    label: 'Needs review',
    tone: 'warning',
    whoDecided: 'No one yet — the model found candidates, but this match is yours to make.',
  },
  auto_matched: {
    label: 'Auto-matched',
    tone: 'ai',
    whoDecided:
      'Matched automatically by the embedding model because similarity cleared the auto-accept threshold. You can reassign it or send it back to review.',
  },
  user_confirmed: {
    label: 'Confirmed by you',
    tone: 'success',
    whoDecided: 'You confirmed this match — it overrides anything the model proposed.',
  },
  new_card: {
    label: 'New card',
    tone: 'info',
    whoDecided:
      'The pipeline found no close match in your catalog, so it created a new entry. Merge it if it turns out to be a duplicate.',
  },
  empty: {
    label: 'Empty slot',
    tone: 'muted',
    whoDecided: 'Marked as an empty pocket during scanning.',
  },
};

export type ConfidenceBand = 'strong' | 'plausible' | 'weak';

// Bands (DESIGN.md · Typography): worded, not just numbered, to avoid
// over-reading false precision from cosine similarity.
export function confidenceBand(similarity: number): ConfidenceBand {
  if (similarity >= 0.9) return 'strong';
  if (similarity >= 0.75) return 'plausible';
  return 'weak';
}

export const BAND_TONE: Record<ConfidenceBand, DecisionTone> = {
  strong: 'success',
  plausible: 'warning',
  weak: 'destructive',
};

export function formatSimilarity(similarity: number): string {
  return `${Math.round(similarity * 100)}%`;
}

export type ProvenanceMeta = {
  label: string;
  tone: DecisionTone;
  whoDecided: string;
};

export function metadataProvenance(
  source: MetadataSource,
  needsMetadata: boolean,
): ProvenanceMeta {
  if (source === 'manual') {
    return { label: 'Edited by you', tone: 'success', whoDecided: 'Metadata entered or corrected by hand — treated as authoritative.' };
  }
  if (source === 'claude-skill') {
    return {
      label: 'AI-enriched',
      tone: 'ai',
      whoDecided:
        'Metadata suggested by the Claude enrichment skill. Check anything you rely on — editing a field makes it yours.',
    };
  }
  if (needsMetadata) {
    return { label: 'Needs info', tone: 'warning', whoDecided: 'No metadata yet — add it by hand or run the enrichment skill.' };
  }
  return { label: 'Unenriched', tone: 'muted', whoDecided: 'No metadata source recorded.' };
}
