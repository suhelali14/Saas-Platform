"""Synthesise the reel's sound effects from the event list the page exports.

    python sfx.py events.json out.wav 30

Every sound is made from noise and sine partials here, so there is nothing
to license: split-flap rattles, rubber-stamp thuds, paper slides, taps, key
clicks. Deliberately no music bed; on Instagram the music is added in the
app, and these effects sit under it.
"""
import json
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)

events = json.load(open(sys.argv[1], encoding="utf-8"))
out_path = sys.argv[2]
dur = float(sys.argv[3])
N = int(SR * dur)
mix = np.zeros((2, N))


def band(sig, lo, hi):
    """Brick-wall band-pass in the frequency domain (fine for short sounds)."""
    spec = np.fft.rfft(sig)
    f = np.fft.rfftfreq(len(sig), 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(spec, len(sig))


def env(n, attack, decay):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / decay)


def norm(s):
    m = np.max(np.abs(s))
    return s / m if m > 0 else s


def add(sig, t, g=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    j = min(N, i + len(sig))
    s = sig[: j - i] * g
    ang = (pan + 1) * np.pi / 4
    mix[0, i:j] += s * np.cos(ang)
    mix[1, i:j] += s * np.sin(ang)


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def click(strength=1.0):
    n = int(SR * 0.012)
    s = norm(band(noise(0.012), 1800, 9000)) * env(n, 0.0002, 0.0016)
    tone = np.sin(2 * np.pi * rng.uniform(2200, 3000) * np.arange(n) / SR) * env(n, 0.0001, 0.003) * 0.35
    return (s + tone) * strength


def thud(f0, f1, tau, length=0.45):
    n = int(SR * length)
    t = np.arange(n) / SR
    freq = f1 + (f0 - f1) * np.exp(-t / 0.05)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * env(n, 0.002, tau)
    slap = norm(band(noise(length), 1500, 6000)) * env(n, 0.0005, 0.012) * 0.5
    low = norm(band(noise(length), 60, 400)) * env(n, 0.001, 0.03) * 0.4
    return norm(body + slap + low)


def swish(length, lo, hi, attack, decay):
    n = int(SR * length)
    return norm(band(noise(length), lo, hi)) * env(n, attack, decay)


for e in events:
    t, typ, g = e["t"], e["type"], e.get("g", 1)
    if typ == "rattle":
        # one flap cell spinning: a click per character, then the settle
        end = e.get("end", t + 0.3)
        pan = rng.uniform(-0.35, 0.35)
        k = t
        while k < end:
            add(click(rng.uniform(0.45, 0.9)), k + rng.uniform(-0.003, 0.003), 0.09 * g, pan)
            k += 1 / 30
        add(click(1.0), end, 0.2 * g, pan)
    elif typ == "stamp":
        add(thud(150, 62, 0.07), t, 0.75 * g)
    elif typ == "thud":
        add(thud(110, 44, 0.14, 0.7), t, 0.85 * g)
    elif typ == "slide":
        add(swish(0.45, 700, 5000, 0.09, 0.12), t, 0.10 * g)
    elif typ == "whoosh":
        add(swish(0.8, 250, 3500, 0.25, 0.2), t, 0.16 * g)
    elif typ == "paper":
        add(swish(0.12, 1500, 7000, 0.004, 0.025), t, 0.12 * g)
        add(thud(220, 120, 0.02, 0.1), t, 0.10 * g)
    elif typ == "lift":
        add(swish(0.7, 400, 2500, 0.3, 0.15), t, 0.08 * g)
    elif typ == "tick":
        n = int(SR * 0.06)
        tt = np.arange(n) / SR
        s = (np.sin(2 * np.pi * 1760 * tt) + 0.4 * np.sin(2 * np.pi * 3520 * tt)) * env(n, 0.0005, 0.012)
        add(s, t, 0.10 * g)
    elif typ == "tap":
        n = int(SR * 0.05)
        tt = np.arange(n) / SR
        s = np.sin(2 * np.pi * 820 * tt) * env(n, 0.0005, 0.008) + norm(band(noise(0.05), 2000, 8000)) * env(n, 0.0002, 0.003) * 0.4
        add(s, t, 0.22 * g)
    elif typ == "key":
        add(click(1.0), t + rng.uniform(-0.004, 0.004), 0.24 * g, rng.uniform(-0.15, 0.15))
        add(thud(260, 150, 0.012, 0.06), t, 0.07 * g)
    elif typ == "pop":
        n = int(SR * 0.07)
        tt = np.arange(n) / SR
        f = 520 + 380 * (1 - np.exp(-tt / 0.02))
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.02), t, 0.10 * g)
    elif typ == "sweep":
        add(swish(0.6, 3000, 9000, 0.25, 0.15), t, 0.035 * g)
    elif typ == "punch":
        add(thud(95, 48, 0.09, 0.5), t, 0.45 * g)
        add(swish(0.35, 2500, 9000, 0.02, 0.1), t, 0.05 * g)
    elif typ == "flip":
        add(click(1.0), t, 0.32 * g)
        add(click(0.6), t + 0.07, 0.22 * g)

# a small room, so the effects sit in a space rather than in a vacuum
ir_n = int(SR * 0.35)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR / 0.07)
ir = band(ir, 200, 7000)
ir = ir / np.sqrt(np.sum(ir ** 2)) * 0.18
L = N + ir_n
wet = np.stack([np.fft.irfft(np.fft.rfft(ch, L) * np.fft.rfft(ir, L), L)[:N] for ch in mix])
out = mix + wet

peak = np.max(np.abs(out))
out = np.tanh(out / peak * 1.3) / np.tanh(1.3) * 0.79  # soft ceiling around -2 dBFS
pcm = (out.T * 32767).astype(np.int16)
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"sfx: {len(events)} events -> {out_path}")
