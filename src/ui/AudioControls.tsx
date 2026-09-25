import { useState } from "react";

import { AUDIO_COPY } from "../audio/audioCopy.ko";
import { audioSettings, setAudioSettings } from "../audio/audioEngine";

/** F0-V: sound on / off and the volume in steps of 10 % (44 px buttons; the choice is a platform preference). */
export function AudioControls() {
  const [settings, setSettings] = useState(audioSettings);
  const apply = (next: typeof settings) => { setAudioSettings(next); setSettings(next); };
  const percent = Math.round(settings.volume * 100);
  return (
    <div className="audio-controls" role="group" aria-label={AUDIO_COPY.group}>
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
