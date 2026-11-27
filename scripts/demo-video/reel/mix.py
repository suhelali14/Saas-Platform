"""Final sound mix: voice + a quiet ambient bed + the page's sound effects.

    python mix.py timeline.json vo.wav sfx.wav out.wav

The bed is synthesised here (soft sine-and-triangle chords with a slow
plucked arpeggio), so there is nothing to license. It starts darker in the
problem chapters and opens up once the ground turns cream, and it ducks
under the voice so every word stays clear.
"""
import json
import sys
import wave

import numpy as np

SR = 44100
tl = json.load(open(sys.argv[1], encoding="utf-8"))
dur = tl["duration"]
N = int(dur * SR)


def read(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        a = a.reshape(-1, w.getnchannels()).T
    if a.shape[0] == 1:
        a = np.vstack([a, a])
    out = np.zeros((2, N), dtype=np.float32)
    m = min(N, a.shape[1])
    out[:, :m] = a[:, :m]
    return out


vo = read(sys.argv[2])
sfx = read(sys.argv[3])

# when the story turns from problem to solution (first cream beat)
turn = next((b["t0"] for b in tl["beats"] if b.get("ground") == "cream"), dur * 0.25)

t = np.arange(N) / SR
BPM = 76
beat = 60 / BPM
bar = beat * 4
note = lambda m: 440 * 2 ** ((m - 69) / 12)
DARK = [[53, 57, 60, 64], [55, 59, 62, 64], [57, 60, 64, 67], [52, 55, 59, 62]]   # Fmaj7 G6 Am7 Em7
BRIGHT = [[48, 52, 55, 59], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 66]]  # Cmaj7 Am7 Fmaj7 G(add#11)
bed = np.zeros(N, dtype=np.float32)
rng = np.random.default_rng(3)
nbars = int(dur / bar) + 2
for k in range(nbars):
    s0 = k * bar
    prog = BRIGHT if s0 >= turn - 0.5 else DARK
    chord = prog[k % 4]
    i0, i1 = int(s0 * SR), min(N, int((s0 + bar + 1.2) * SR))
    if i0 >= N:
        break
    tt = t[i0:i1] - s0
    env = np.minimum(1, tt / 1.1) * np.exp(-np.maximum(0, tt - bar) / 0.5)
    for m in chord:
        f = note(m)
        for det in (-0.12, 0.12):
            ph = 2 * np.pi * f * (1 + det / 100) * tt
            bed[i0:i1] += (np.sin(ph) + 0.18 * np.sin(2 * ph)) * env * 0.05
    # sub root
    bed[i0:i1] += np.sin(2 * np.pi * note(chord[0] - 12) * tt) * env * 0.06
    # plucked arpeggio on eighths, brighter after the turn
    if s0 >= turn - 0.5:
        pattern = [chord[0] + 12, chord[2] + 12, chord[1] + 12, chord[3] + 12, chord[2] + 12, chord[1] + 12, chord[3], chord[2] + 12]
        for e, m in enumerate(pattern):
            ps = s0 + e * beat / 2
            j0, j1 = int(ps * SR), min(N, int((ps + 1.0) * SR))
            if j0 >= N:
                break
            pt = t[j0:j1] - ps
            bed[j0:j1] += np.sin(2 * np.pi * note(m) * pt) * np.exp(-pt / 0.22) * 0.035 * rng.uniform(0.7, 1.0)

# gentle low-pass: a one-pole's magnitude response applied in the frequency
# domain (one FFT instead of a per-sample Python loop)
spec = np.fft.rfft(bed)
f = np.fft.rfftfreq(len(bed), 1 / SR)
spec *= 1 / np.sqrt(1 + (f / 3200) ** 2)
bed = np.fft.irfft(spec, len(bed)).astype(np.float32)
fade = np.minimum(1, t / 2.0) * np.minimum(1, (dur - t) / 2.5)
bed *= np.clip(fade, 0, 1)

# duck under the voice: smoothed envelope of the voice track
v = np.abs(vo[0])
win = int(0.25 * SR)
# moving average by running sum (np.convolve with an 11k window is minutes)
cs = np.concatenate([[0.0], np.cumsum(v, dtype=np.float64)])
idx = np.arange(len(v))
lo, hi = np.clip(idx - win // 2, 0, len(v)), np.clip(idx + win // 2, 0, len(v))
envv = ((cs[hi] - cs[lo]) / win).astype(np.float32)
duck = 1 - 0.55 * np.clip(envv / (envv.max() * 0.25 + 1e-9), 0, 1)
bed *= duck

bedL = bed
bedR = np.roll(bed, int(0.011 * SR))  # a touch of width
music = np.vstack([bedL, bedR])
music *= 0.42 / (np.max(np.abs(music)) + 1e-9)

# ---- scene sound: what the place sounds like, beat by beat ----------------
amb = np.zeros((2, N), dtype=np.float32)
rng2 = np.random.default_rng(11)


def bandnoise(n, lo, hi):
    spec = np.fft.rfft(rng2.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    x = np.fft.irfft(spec, n)
    return (x / (np.max(np.abs(x)) + 1e-9)).astype(np.float32)


def slow_env(n, rate, depth, seed):
    """smooth random amplitude movement, `rate` changes per second"""
    k = max(2, int(n / SR * rate) + 2)
    pts = np.random.default_rng(seed).uniform(1 - depth, 1, k)
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), pts).astype(np.float32)


beats = tl["beats"]
problem = [b for b in beats if b.get("ground") == "dark"]
if problem:
    p0, p1 = problem[0]["t0"], problem[-1]["t1"]
    i0, i1 = int(p0 * SR), min(N, int((p1 + 0.6) * SR))
    n = i1 - i0
    tt = np.arange(n) / SR
    # a full waiting room: low room tone, plus a murmur of voices (speech-band
    # noise moving at syllable rate), plus far-off chatter in the other ear
    room = bandnoise(n, 90, 700) * 0.35 * slow_env(n, 0.5, 0.4, 1)
    murmur = bandnoise(n, 250, 2600) * slow_env(n, 5.0, 0.85, 2) * slow_env(n, 0.4, 0.5, 3)
    chatter = bandnoise(n, 400, 3200) * slow_env(n, 6.5, 0.9, 4) * slow_env(n, 0.3, 0.7, 5)
    fade = np.minimum(1, tt / 0.8) * np.clip((p1 + 0.6 - p0 - tt) / 1.4, 0, 1)
    amb[0, i0:i1] += (room + murmur * 0.55 + chatter * 0.25) * fade
    amb[1, i0:i1] += (room + murmur * 0.45 + chatter * 0.4) * fade
    # a wall clock ticking through the opening beat
    b0 = beats[0]
    k = b0["t0"] + 0.15
    tick = 0
    while k < b0["t1"]:
        m = int(0.018 * SR)
        j = int(k * SR)
        if j + m < N:
            env = np.exp(-np.arange(m) / SR / 0.0025)
            s = bandnoise(m, 2500 if tick % 2 == 0 else 1800, 7000) * env
            amb[:, j:j + m] += s * 0.9
        k += 1.0
        tick += 1
# the turn: a rising sweep into the wipe, then a soft chime as the cream arrives
if problem and turn < dur:
    rs = max(0, turn - 1.7)
    i0, i1 = int(rs * SR), int(turn * SR)
    n = i1 - i0
    tt = np.arange(n) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(220 + 600 * (tt / tt[-1]) ** 2) / SR)
    air = bandnoise(n, 1500, 8000) * (tt / tt[-1]) ** 2
    rise = (sweep * 0.5 + air * 0.6) * (tt / tt[-1]) ** 1.5
    amb[:, i0:i1] += rise * 0.8
    j = int(turn * SR)
    n = min(int(2.4 * SR), N - j)
    tt = np.arange(n) / SR
    chime = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) for f, a, d in [(784, 1, 1.4), (1176, 0.6, 1.1), (1568, 0.35, 0.8), (2352, 0.15, 0.5)])
    amb[0, j:j + n] += chime * 0.55
    amb[1, j + 220:j + n] += chime[: n - 220] * 0.55
amb *= duck  # keep the room under the voice too
amb *= 0.32 / (np.max(np.abs(amb)) + 1e-9)

mix = vo * 1.0 + music * 0.55 + sfx * 0.6 + amb * 0.6
peak = np.max(np.abs(mix))
mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.9
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[4], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"mix: {dur:.1f}s, turn at {turn:.1f}s -> {sys.argv[4]}")
