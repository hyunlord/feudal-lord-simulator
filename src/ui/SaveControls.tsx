import { formatSlotLabel, SAVE_COPY } from "../content/saveCopy.ko";
import { useSaveSystemContext } from "../state/saveSystem";

export function SaveControls() {
  const save = useSaveSystemContext();
  return (
    <div className="save-controls" role="group" aria-label={SAVE_COPY.saveControlsLabel}>
      <button className="autoplay-toggle save-control-button" type="button" disabled={!save.ready || save.busy} onClick={() => save.saveNow()}>
        {SAVE_COPY.saveNow}
      </button>
      <span className="autoplay-hint">{SAVE_COPY.loadRecent}</span>
      {save.recent.length === 0 ? <span className="autoplay-hint">{SAVE_COPY.noSaves}</span> : (
        <ul className="save-slot-list">
          {save.recent.map(meta => (
            <li key={meta.slotId}>
              <button className="autoplay-toggle save-control-button save-slot-button" type="button" disabled={save.busy}
                onClick={() => save.load(meta.slotId)}>
                <strong>{formatSlotLabel(meta.slotId)}</strong>
                <span>{meta.summary?.line ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {save.notice === null ? null : <span className="autoplay-hint" role="status">{save.notice}</span>}
    </div>
  );
}
