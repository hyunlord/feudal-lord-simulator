"""AUDIO-1 sounds made by this project (no recording): the three season ambiences beside F0-V's spring, the building
loops, the walkers' loops, the event sounds and the completion fanfare, each a mono 44.1 kHz WAV. Loops are exactly
periodic (noise is filtered in the frequency domain of the whole loop, and every event wraps round its end), so a
looped buffer has no seam and no fade. Kenney CC0 samples (decoded with ffmpeg) are layered in where a real knock,
creak or strike sounds better than a synthetic one. Deterministic (one seed per sound).
Run: python3 scripts/synthAudioP1.py <kenney-dir> <out-dir>"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

RATE = 44_100
KENNEY, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)


def seconds(n: float) -> int:
    return int(round(n * RATE))


def band_noise(rng, n: int, low: float, high: float, tilt: float = 0.0) -> np.ndarray:
    """Periodic noise of length n between low and high Hz (soft edges), tilted by `tilt` dB per octave."""
    spectrum = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / RATE)
    gain = 1 / (1 + (low / np.maximum(freqs, 1)) ** 4) / (1 + (freqs / high) ** 4)
    if tilt:
        gain *= (np.maximum(freqs, 20) / 1000) ** (tilt / 6.02)
    out = np.fft.irfft(spectrum * gain, n)
    return out / (np.abs(out).max() + 1e-9)


def lfo(n: int, cycles: float, phase: float = 0.0) -> np.ndarray:
    """0..1, a whole number of cycles over the loop."""
    return 0.5 + 0.5 * np.sin(2 * np.pi * (cycles * np.arange(n) / n + phase))


def place(buffer: np.ndarray, start: int, clip: np.ndarray, gain: float = 1.0) -> None:
    """Adds `clip` at `start`, wrapping round the loop's end."""
    index = (start + np.arange(len(clip))) % len(buffer)
    np.add.at(buffer, index, clip * gain)


def kenney(relative: str, pitch: float = 1.0) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(KENNEY / relative), "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    data = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    if pitch != 1.0:
        data = np.interp(np.arange(0, len(data) - 1, pitch), np.arange(len(data)), data)
    return data / (np.abs(data).max() + 1e-9)


def envelope(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / RATE
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


BELL_RATIOS = [0.5, 1.0, 1.183, 1.506, 2.0, 2.514, 2.662, 3.011, 4.166]
BELL_LEVELS = [0.55, 1.0, 0.6, 0.4, 0.65, 0.3, 0.2, 0.22, 0.1]
BELL_DECAYS = [4.0, 3.0, 2.2, 1.8, 1.5, 1.2, 1.0, 0.8, 0.5]


def bell(rng, f0: float, length: float, stretch: float = 1.0) -> np.ndarray:
    """A struck bell: its inharmonic partials, each ringing down on its own, and the clapper's click."""
    n = seconds(length)
    t = np.arange(n) / RATE
    out = np.zeros(n)
    for ratio, level, decay in zip(BELL_RATIOS, BELL_LEVELS, BELL_DECAYS):
        detune = 1 + rng.uniform(-0.002, 0.002)
        out += level * np.sin(2 * np.pi * f0 * ratio * detune * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / (decay * stretch))
    click = band_noise(rng, n, 1500, 7000) * np.exp(-t / 0.004) * 0.3
    out = (out + click) * np.minimum(1, t / 0.002)
    return out / (np.abs(out).max() + 1e-9)


def crackles(rng, n: int, rate: float, low: float, high: float) -> np.ndarray:
    """Fire crackle: short filtered bursts at random, of random strength."""
    grain = band_noise(rng, seconds(0.02), low, high)
    out = np.zeros(n)
    for start in rng.uniform(0, n, int(rate * n / RATE)).astype(int):
        length = rng.integers(seconds(0.002), seconds(0.012))
        clip = grain[:length] * np.exp(-np.arange(length) / (length / 3)) * rng.exponential(0.5)
        place(out, start, clip)
    return out


def write(name: str, signal: np.ndarray, level: float = 0.85) -> None:
    peak = np.abs(signal).max() + 1e-9
    data = (signal / peak * level * 32_767).astype(np.int16)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(RATE); out.writeframes(data.tobytes())


# ---- Season ambiences (12 s loops; spring is F0-V's) ------------------------------------------------------------
def summer() -> np.ndarray:
    rng = np.random.default_rng(1301); n = seconds(12)
    out = band_noise(rng, n, 80, 600) * 0.08 * (0.6 + 0.4 * lfo(n, 2))
    for carrier, period, level in ((4_400, 0.82, 0.10), (4_750, 1.13, 0.07), (4_150, 0.95, 0.05)):
        t0 = rng.uniform(0, period)
        pulse = seconds(0.012)
        tone = np.sin(2 * np.pi * carrier * np.arange(pulse) / RATE) * np.sin(np.pi * np.arange(pulse) / pulse) ** 2
        at = t0
        while at < 12:
            for k in range(rng.integers(3, 5)):
                place(out, seconds(at + k * 0.03), tone, level)
            at += period * rng.uniform(0.85, 1.15)
    cicada = band_noise(rng, n, 5_000, 7_500) * (np.sin(2 * np.pi * 38 * np.arange(n) / RATE) ** 2) * 0.05 * lfo(n, 1, 0.25)
    return out + cicada


def autumn() -> np.ndarray:
    rng = np.random.default_rng(1302); n = seconds(12)
    gusts = 0.35 + 0.35 * lfo(n, 1) + 0.2 * lfo(n, 3, 0.3) + 0.1 * lfo(n, 5, 0.7)
    wind = band_noise(rng, n, 100, 900, tilt=-3) * 0.25 * gusts
    leaves = band_noise(rng, n, 2_000, 6_000)
    rustle = np.zeros(n)
    for start in rng.uniform(0, 12, 9):
        length = seconds(rng.uniform(0.3, 0.8))
        shape = np.sin(np.pi * np.arange(length) / length) ** 2
        place(rustle, seconds(start), shape * rng.uniform(0.4, 1.0))
    return wind + leaves * rustle * 0.06


def winter() -> np.ndarray:
    rng = np.random.default_rng(1303); n = seconds(12)
    out = band_noise(rng, n, 250, 1_800, tilt=-2) * 0.12 * (0.5 + 0.5 * lfo(n, 2, 0.1))
    for centre, cycles, phase in ((700, 1, 0.0), (950, 2, 0.4), (1_250, 3, 0.8)):
        out += band_noise(rng, n, centre * 0.94, centre * 1.06) * 0.07 * lfo(n, cycles, phase) ** 2
    return out + band_noise(rng, n, 40, 150) * 0.05


# ---- Building loops ------------------------------------------------------------------------------------------------
def mill() -> np.ndarray:
    rng = np.random.default_rng(1310); n = seconds(5)
    whoosh = band_noise(rng, n, 150, 700)
    shape = np.zeros(n)
    pulse = seconds(0.7)
    for k in range(4):
        place(shape, seconds(k * 1.25), np.sin(np.pi * np.arange(pulse) / pulse) ** 2)
    out = whoosh * shape * 0.25 + band_noise(rng, n, 50, 120) * 0.05
    place(out, seconds(0.3), kenney("kenney_rpg-audio/Audio/creak1.ogg", 0.7), 0.3)
    place(out, seconds(2.8), kenney("kenney_rpg-audio/Audio/creak2.ogg", 0.6), 0.25)
    return out


def oven() -> np.ndarray:
    rng = np.random.default_rng(1311); n = seconds(6)
    roar = band_noise(rng, n, 60, 400) * 0.12 * (0.7 + 0.3 * lfo(n, 7, 0.2))
    return roar + crackles(rng, n, 14, 1_500, 6_000) * 0.6


def saw() -> np.ndarray:
    rng = np.random.default_rng(1312); n = seconds(4.8)
    out = np.zeros(n)
    stroke = seconds(0.8)
    t = np.arange(stroke) / RATE
    for k in range(6):
        push = k % 2 == 0
        rasp = band_noise(rng, stroke, 900 if push else 1_200, 2_800 if push else 3_500)
        teeth = 0.55 + 0.45 * np.sin(2 * np.pi * (52 if push else 64) * t) ** 2
        shape = np.sin(np.pi * t / 0.8) ** 0.7
        body = band_noise(rng, stroke, 150, 400) * 0.25
        place(out, k * stroke, (rasp * teeth + body) * shape, 0.18 * rng.uniform(0.85, 1.1))
    return out


def quarry() -> np.ndarray:
    n = seconds(4.4)
    out = np.zeros(n)
    for at, clip, pitch, gain in ((0.0, "000", 1.0, 0.8), (1.05, "002", 0.95, 0.7), (2.2, "004", 1.05, 0.75), (3.3, "001", 0.9, 0.7)):
        place(out, seconds(at), kenney(f"kenney_impact-sounds/Audio/impactMining_{clip}.ogg", pitch), gain)
    place(out, seconds(1.6), kenney("kenney_impact-sounds/Audio/impactMining_003.ogg", 1.6), 0.2)
    return out


def babble(rng, n: int, voices: int = 14) -> np.ndarray:
    """A crowd's murmur: speech-band noise in narrow bands, each opened and shut at syllable rate."""
    out = np.zeros(n)
    t = np.arange(n) / RATE
    for _ in range(voices):
        centre = rng.uniform(300, 2_400)
        voice = band_noise(rng, n, centre * 0.8, centre * 1.25)
        rate = rng.uniform(3, 6)
        syllables = np.clip(np.sin(2 * np.pi * rate * t + rng.uniform(0, 2 * np.pi)) + rng.uniform(-0.2, 0.4), 0, None) ** 1.5
        phrases = lfo(n, int(rng.integers(1, 4)), rng.uniform(0, 1)) ** 2
        out += voice * syllables * phrases * rng.uniform(0.5, 1.0)
    return out / (np.abs(out).max() + 1e-9)


def market() -> np.ndarray:
    rng = np.random.default_rng(1313); n = seconds(8)
    out = babble(rng, n) * 0.35 + band_noise(rng, n, 120, 500) * 0.04
    place(out, seconds(2.3), kenney("kenney_rpg-audio/Audio/handleCoins.ogg"), 0.18)
    place(out, seconds(5.6), kenney("kenney_rpg-audio/Audio/handleCoins2.ogg"), 0.22)
    return out


def church_bell() -> np.ndarray:
    rng = np.random.default_rng(1314); n = seconds(7.5)
    out = np.zeros(n)
    for at in (0.0, 2.3, 4.6):
        clip = bell(rng, 196, 7.5 - at)
        out[seconds(at):seconds(at) + len(clip)] += clip[: n - seconds(at)]
    return out


# ---- Walkers -------------------------------------------------------------------------------------------------------
def ox() -> np.ndarray:
    rng = np.random.default_rng(1320); n = seconds(2.8)
    out = band_noise(rng, n, 60, 200) * 0.02
    for k, clip in enumerate(("000", "002", "004", "001")):
        place(out, seconds(k * 0.7), kenney(f"kenney_impact-sounds/Audio/footstep_wood_{clip}.ogg", 0.8), 0.5)
    for at in (0.35, 1.75):
        place(out, seconds(at), kenney("kenney_rpg-audio/Audio/creak3.ogg", 0.55), 0.22)
    return out


def sheep() -> np.ndarray:
    rng = np.random.default_rng(1321); n = seconds(4)
    out = band_noise(rng, n, 2_000, 5_000) * 0.01
    for start in rng.uniform(0, 4, 7):
        f0 = rng.uniform(1_300, 2_100)
        length = seconds(0.45)
        t = np.arange(length) / RATE
        tink = sum(level * np.sin(2 * np.pi * f0 * ratio * t) * np.exp(-t / decay) for ratio, level, decay in ((1, 1, 0.3), (2.76, 0.4, 0.15), (5.4, 0.2, 0.08)))
        place(out, seconds(start), tink * np.minimum(1, t / 0.001), rng.uniform(0.25, 0.45))
    return out


# ---- Events --------------------------------------------------------------------------------------------------------
def fire() -> np.ndarray:
    rng = np.random.default_rng(1330); n = seconds(6)
    roar = band_noise(rng, n, 50, 600, tilt=-2) * 0.3 * (0.65 + 0.35 * lfo(n, 11, 0.1)) * (0.8 + 0.2 * lfo(n, 3))
    pops = np.zeros(n)
    for start in rng.uniform(0, n, 9).astype(int):
        length = seconds(0.08)
        place(pops, start, band_noise(rng, length, 80, 300) * np.exp(-np.arange(length) / seconds(0.02)), rng.uniform(0.2, 0.4))
    return roar + crackles(rng, n, 32, 1_200, 7_000) * 0.9 + pops


def rain() -> np.ndarray:
    rng = np.random.default_rng(1331); n = seconds(8)
    out = band_noise(rng, n, 800, 8_000, tilt=-3) * 0.15 * (0.85 + 0.15 * lfo(n, 2))
    drop = seconds(0.006)
    grain = band_noise(rng, drop, 2_000, 7_000) * np.exp(-np.arange(drop) / (drop / 4))
    for start in rng.uniform(0, n, 60 * 8).astype(int):
        place(out, start, grain, rng.exponential(0.05))
    plop = seconds(0.05)
    for start in rng.uniform(0, n, 8).astype(int):
        tone = np.sin(2 * np.pi * rng.uniform(500, 900) * np.arange(plop) / RATE) * np.exp(-np.arange(plop) / seconds(0.012))
        place(out, start, tone, 0.05)
    return out


def famine_omen_bell() -> np.ndarray:
    rng = np.random.default_rng(1332); n = seconds(5.5)
    out = np.zeros(n)
    for at, level in ((0.0, 1.0), (2.4, 0.8)):
        clip = bell(rng, 110, 5.5 - at, stretch=1.4)
        out[seconds(at):seconds(at) + len(clip)] += clip[: n - seconds(at)] * level
    return out


def petition_arrival() -> np.ndarray:
    rng = np.random.default_rng(1333); n = seconds(1.8)
    out = np.zeros(n)
    for at, clip, gain in ((0.0, "000", 0.8), (0.26, "002", 0.7), (0.52, "001", 0.85)):
        knock = kenney(f"kenney_impact-sounds/Audio/impactWood_heavy_{clip}.ogg")
        out[seconds(at):seconds(at) + len(knock)] += knock[: n - seconds(at)] * gain
    murmur = babble(rng, seconds(1.0), voices=6) * np.sin(np.pi * np.arange(seconds(1.0)) / seconds(1.0)) ** 2
    out[seconds(0.75):seconds(0.75) + len(murmur)] += murmur[: n - seconds(0.75)] * 0.18
    return out


def great_famine() -> np.ndarray:
    rng = np.random.default_rng(1334); n = seconds(5.2)
    t = np.arange(n) / RATE
    drone = sum(np.sin(2 * np.pi * f * k * t) / k for f in (55.0, 55.6) for k in range(1, 7))
    drone = np.fft.irfft(np.fft.rfft(drone) / (1 + (np.fft.rfftfreq(n, 1 / RATE) / 300) ** 4), n)
    shape = np.minimum(1, t / 0.8) * np.minimum(1, (5.2 - t) / 1.2)
    out = drone / (np.abs(drone).max() + 1e-9) * 0.45 * shape
    for at, level in ((0.2, 0.9), (2.6, 0.75)):
        clip = bell(rng, 82, 5.2 - at, stretch=1.2)
        out[seconds(at):seconds(at) + len(clip)] += clip[: n - seconds(at)] * level
    return out


def fanfare() -> np.ndarray:
    """A short horn call: G4, C5, then the C major chord, horn-like (odd-heavy harmonics, soft attack, slight vibrato)."""
    n = seconds(1.2)
    out = np.zeros(n)
    def horn(freq: float, length: float) -> np.ndarray:
        m = seconds(length); t = np.arange(m) / RATE
        vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t)
        tone = sum((1.0 / k) * (1.0 if k % 2 else 0.55) * np.sin(2 * np.pi * freq * k * vib * t) for k in range(1, 9))
        return tone * np.minimum(1, t / 0.025) * np.minimum(1, (length - t) / 0.12)
    place(out, 0, horn(392.0, 0.17), 0.5)
    place(out, seconds(0.18), horn(523.25, 0.17), 0.5)
    for freq in (523.25, 659.25, 783.99):
        place(out, seconds(0.36), horn(freq, 0.8), 0.35)
    return out


SOUNDS = {"summer_ambience": summer, "autumn_ambience": autumn, "winter_ambience": winter, "mill_loop": mill, "oven_loop": oven,
          "saw_loop": saw, "quarry_loop": quarry, "market_loop": market, "church_bell": church_bell, "ox_loop": ox, "sheep_loop": sheep,
          "fire_loop": fire, "rain_loop": rain, "famine_omen_bell": famine_omen_bell, "petition_arrival": petition_arrival,
          "great_famine": great_famine, "fanfare": fanfare}
for name, make in SOUNDS.items():
    write(name, make())
print(len(SOUNDS))
