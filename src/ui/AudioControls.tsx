import { useState } from "react";

import { AUDIO_COPY } from "../audio/audioCopy.ko";
import { audioSettings, setAudioSettings, type SoundBus } from "../audio/audioEngine";
import { Slider, Toggle } from "./kit";

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
          <div key={bus} className="audio-bus" data-bus={bus}>
            <span className="autoplay-hint" aria-hidden="true">{AUDIO_COPY.busLevel(AUDIO_COPY.buses[bus], level)}</span>
            <Slider min={0} max={100} step={10} value={level} label={AUDIO_COPY.busLabel(AUDIO_COPY.buses[bus])} valueText={AUDIO_COPY.busLevel(AUDIO_COPY.buses[bus], level)}
              onChange={value => apply({ ...settings, buses: { ...settings.buses, [bus]: value / 100 } })} />
          </div>
        );
      })}
      <Toggle className="autoplay-toggle" checked={!settings.muted} label={`${AUDIO_COPY.mute} ${settings.muted ? AUDIO_COPY.off : AUDIO_COPY.on}`}
        onChange={on => apply({ ...settings, muted: !on })} />
      {/* UI-KIT-1: the whole volume is a slider too (was − and + buttons: symbols standing in for icons). */}
      <div className="audio-bus" data-bus="master">
        <span className="autoplay-hint" aria-hidden="true">{AUDIO_COPY.volume(percent)}</span>
        <Slider min={0} max={100} step={10} value={percent} label={AUDIO_COPY.volumeLabel} valueText={AUDIO_COPY.volume(percent)}
          onChange={value => apply({ ...settings, volume: value / 100 })} />
      </div>
    </div>
  );
}
