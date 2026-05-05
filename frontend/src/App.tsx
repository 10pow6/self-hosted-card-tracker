import { useState } from 'react';
import { commitScan, previewScan } from './scanApi';
import { PolygonEditor } from './PolygonEditor';
import { SlotThumbnails } from './SlotThumbnails';
import type { CommitResponse, PreviewResponse, Slot } from './types';
import './App.css';

function App() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [committed, setCommitted] = useState<CommitResponse | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await previewScan(file);
      setPreview(res);
      setSlots(res.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await commitScan(preview.scan_id, slots);
      setCommitted(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    setPreview(null);
    setSlots([]);
    setCommitted(null);
    setError(null);
  };

  return (
    <main className="app">
      <h1>Scan a binder page</h1>

      {!preview && (
        <label className="upload-label">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            disabled={busy}
          />
          <span>{busy ? 'Detecting…' : 'Choose / take photo'}</span>
        </label>
      )}

      {error && <div className="error">{error}</div>}

      {preview && !committed && (
        <>
          <div className="status">
            {slots.filter((s) => s.refined && !s.disabled).length}/9 auto-detected.
            Drag boxes or corners. × to mark empty, + to re-add. Pinch to zoom, drag background to pan.
          </div>
          <PolygonEditor
            imageUrl={preview.image_url}
            imageSize={preview.image_size}
            bbox={preview.bbox}
            slots={slots}
            onChange={setSlots}
          />
          <SlotThumbnails
            imageUrl={preview.image_url}
            imageSize={preview.image_size}
            slots={slots}
          />
          <div className="actions">
            <button onClick={onReset} disabled={busy}>
              Start over
            </button>
            <button className="primary" onClick={onConfirm} disabled={busy}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </>
      )}

      {committed && (
        <>
          <div className="status">
            Saved {committed.crops.length} card crop{committed.crops.length === 1 ? '' : 's'}
            {committed.empty_slots.length
              ? ` (${committed.empty_slots.length} empty pocket${committed.empty_slots.length === 1 ? '' : 's'})`
              : ''}
            .
          </div>
          <div className="thumbs">
            {committed.crops.map((c) => (
              <div key={c.slot_index} className="thumb refined">
                <img src={c.crop_url} alt={`slot ${c.slot_index + 1}`} />
                <span className="thumb-label">{c.slot_index + 1}</span>
              </div>
            ))}
            {committed.empty_slots.map((idx) => (
              <div key={`e-${idx}`} className="thumb thumb-empty">
                <span>{idx + 1}</span>
                <span className="empty-label">empty</span>
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="primary" onClick={onReset}>
              Scan another page
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default App;
