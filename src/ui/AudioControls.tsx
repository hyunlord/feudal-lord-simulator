import { useState } from "react";

import { AUDIO_COPY } from "../audio/audioCopy.ko";
import { audioSettings, setAudioSettings, type SoundBus } from "../audio/audioEngine";

/**
 * F0-V: sound on / off and the volume in steps of 10 % (44 px buttons; the choice is a platform preference).
 * AUDIO-1 mixer: a slider for each bus — the screen's own sounds, the alerts, the town (world) — in steps of 10 %.
 */
export function AudioControls() {
  const [settings, setSettings] = useState(audioSettings);
  const apply = (next: typeof settings) => { setAudioSettings(next); setSettings(next); };
  const percent = Math.round(settings.volume * 100);
  return (
    <div className="audio-controls" role="group" aria-label={AUDIO_COPY.group}>
      {(["ui", "alert", "world"] as const satisfies readonly SoundBus[]).map(bus => {
        const level = Math.round(settings.buses[bus] * 100);
        return (
          <label key={bus} className="audio-bus" data-bus={bus}>
            <span className="autoplay-hint">{AUDIO_COPY.busLevel(AUDIO_COPY.buses[bus], level)}</span>
            <input type="range" min={0} max={100} step={10} value={level} aria-label={AUDIO_COPY.busLabel(AUDIO_COPY.buses[bus])}
              onChange={event => apply({ ...settings, buses: { ...settings.buses, [bus]: Number(event.currentTarget.value) / 100 } })} />
          </label>
        );
      })}
      <button type="button" role="switch" aria-checked={!settings.muted} className="autoplay-toggle"
        onClick={() => apply({ ...settings, muted: !settings.muted })}>{AUDIO_COPY.mute} {settings.muted ? AUDIO_COPY.off : AUDIO_COPY.on}</button>
      <button type="button" className="autoplay-toggle" aria-label={AUDIO_COPY.quieter} disabled={percent <= 0}
        onClick={() => apply({ ...settings, volume: Math.max(0, Math.round(settings.volume * 10 - 1) / 10) })}>−</button>
      <span className="autoplay-hint">{AUDIO_COPY.volume(percent)}</span>
      <button type="button" className="autoplay-toggle" aria-label={AUDIO_COPY.louder} disabled={percent >= 100}
        onClick={() => apply({ ...settings, volume: Math.min(1, Math.round(settings.volume * 10 + 1) / 10) })}>+</button>
    </div>
  );
}
