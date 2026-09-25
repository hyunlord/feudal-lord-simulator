"""F0-V spring ambience, synthesized (no recording): 12 s seamless loop of a soft wind (low-passed noise, slow swell)
and sparse bird chirps (short rising sine sweeps with a soft envelope), mono 44.1 kHz WAV. Deterministic (seed 1300).
Run: python3 scripts/synthAmbience.py <out.wav>"""
import sys
import wave

import numpy as np

RATE, SECONDS = 44_100, 12
n = RATE * SECONDS
rng = np.random.default_rng(1300)
t = np.arange(n) / RATE
noise = rng.standard_normal(n)
# One-pole low-pass twice (wind), then a slow swell; wrapped so the loop has no seam.
wind = np.zeros(n)
for _ in range(2):
    a, acc = 0.02, 0.0
    for i in range(n):
        acc += a * (noise[i] - acc)
        wind[i] = acc
    noise = wind.copy()
wind *= (0.6 + 0.4 * np.sin(2 * np.pi * t / SECONDS)) * 0.35 / (np.abs(wind).max() + 1e-9)
birds = np.zeros(n)
for start in rng.uniform(0.3, SECONDS - 0.6, 14):
    length = rng.uniform(0.08, 0.18)
    f0, f1 = rng.uniform(2_600, 3_400), rng.uniform(3_800, 5_200)
    count = int(length * RATE)
    s = np.arange(count) / RATE
    phase = 2 * np.pi * (f0 * s + (f1 - f0) * s * s / (2 * length))
    envelope = np.sin(np.pi * s / length) ** 2
    begin = int(start * RATE)
    birds[begin:begin + count] += 0.18 * envelope * np.sin(phase)
signal = wind + birds
fade = int(0.05 * RATE)
signal[:fade] *= np.linspace(0, 1, fade)
signal[-fade:] *= np.linspace(1, 0, fade)
data = (np.clip(signal, -1, 1) * 32_767 * 0.8).astype(np.int16)
with wave.open(sys.argv[1], "wb") as out:
    out.setnchannels(1); out.setsampwidth(2); out.setframerate(RATE); out.writeframes(data.tobytes())
