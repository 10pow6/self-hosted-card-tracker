export type Point = { x: number; y: number };

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
  slots: Slot[];
};

export type RawPreviewResponse = Omit<PreviewResponse, 'slots'> & {
  slots: Array<{
    slot_index: number;
    polygon: [[number, number], [number, number], [number, number], [number, number]];
    refined: boolean;
  }>;
};

export type CommitResponse = {
  scan_id: string;
  crops: Array<{ slot_index: number; crop_url: string }>;
  empty_slots: number[];
};
