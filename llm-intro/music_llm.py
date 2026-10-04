"""Score and sound design for "How a large language model works": A minor -> C major, 96 BPM, 24 bars of 2.5 s.

    python3 llm-intro/music_llm.py [--cues FILE] [--out-dir DIR]     -> music.wav, music.mp3 (44.1 kHz stereo, 60.0 s)

Locked to the visual bar grid: bar k starts at k * 2.5 s, one beat is 0.625 s.  Every drum hit sits on that grid.

Structure (energy map, global time):
    bars 0-1    0-5 s     sparse: heartbeat pulse, glassy keys play the "next word" motif as a question (it hangs on the
                          5th), a riser peaks exactly at 3.125 s (bar 1 beat 2) where the title chord (Fmaj7) blooms
    bars 2-5    5-15 s    curious groove: kalimba/marimba 8th arps, soft kick on 1 and 3, shaker/hat, warm pad
    bars 6-8    15-22.5   build: strings enter, arps in 16ths, pad filter rises, snare roll + riser into 22.5 s
    bars 9-10   22.5-27.5 the "aha": lift to C major, bright bells, light drums, space for 'up'/'chime'
    bars 11-13  27.5-35   dark and driving: sub pulsing in 8ths, low string ostinato, data-tick hats, E7 tension
    bars 14-16  35-42.5   peak: four-on-the-floor, snare/clap, bass line, 16th arps, a riser through the last bar
    bars 17-19  42.5-50   release: felt piano + pad + gentle beat (human feel), building slowly
    bars 20-23  50-60     finale: pad swell, the motif RESOLVED over strings, full beat in bars 21-22,
                          last bar = long C major(add9) chord that rings and fades to true silence by 59.8 s

The motif ("next word"): A4 C5 E5 D5 then E5 held (question: hangs on the 5th) / C5 held (answer: lands on the tonic).
Chords by bar: 0-1 Am (F from 3.125 s) | 2-5 Am F C G | 6-8 Am F G | 9-10 C G | 11-13 Am Dm E | 14-16 Am F G |
17-19 C F G | 20-23 Am F Am-G C   (table CHORDS below).
Question motif over G chords is G B D E D (a C would be an avoid-note against the chord's B).

Sound design: every cue name of SPEC.md section 5 has a foley-style synth (pentatonic-snapped pitches, chord-aware: A C D E G,
or A B D E G# over the E7 of bar 13, consecutive cues of one name never share a pitch unless the sheet repeats it).  `whoosh`: t is the
START of the sweep; rev=1 is a build that rises slowly and ends abruptly at t + dur (so a rev whoosh into a hit starts `dur` earlier).
Bed stems (pad, strings, plucks, drums, bass) have their own convolution reverbs (returns high-passed at 150-170 Hz); the pad and
strings are widened (decorrelated above 150 Hz, mono below) and filtered by a time-varying low-pass automation; they are ducked by the
kick; big cues (hit, boom, stamp...) duck the whole bed a little, and an 80 ms gap (-12 dB, whole mix, back at unity on the hit) precedes the title bloom at 3.125 s.
Noise-based sounds (risers, crashes, reversed crash, snares, the riser cue) are tilted about -3 dB/oct above 5 kHz and low-passed at 9.5 kHz so
that noise stacks (riser + snare roll + reversed crash) do not hiss; the kick fundamental follows the chord root (no beating against the sub);
the intro (bars 0-1) is kept 4 dB lower than the groove before the bloom so the typing (0.5-2.2 s) and the 80 ms gap read; step cues have a
tonal 1.8-2.4 kHz component so they stand out from the 16th hats.
Balance: the sfx bus sits SFX_GAIN (-2.5 dB) under the bed (type / tick / blip softer, pop / ping / swell stronger), the sub and kick
carry less 60 Hz weight, the melodic and drum buses have a presence shelf.  Every waveform ends in a raised-cosine fade (no cut tails).
Master: glue compressor -> true-peak look-ahead limiter (4x oversampled, ramped gain, ceiling -2 dBTP, starts at unity) levelled to
-14 LUFS by measurement (no peak-normalisation) -> curved fade from 58.2 s to true silence at 59.8 s.  music.wav is therefore already
at -14 LUFS / TP -2 dBTP; music.mp3 is the two-pass ffmpeg loudnorm (-14 LUFS, TP -2) of it, then alimiter at -2.3 dB (LAME overshoots by about 1 dB: TP <= -1.2) and is the deliverable (it decodes 219
samples = 5 ms later than the wav and its container start_time is 0.025 s: the LAME delay; mux with -ss 0, the 5 ms is below a frame).
Everything is deterministic (seeded RNG keyed by note / cue time, cues processed in time order); unknown cue names, bad times and bad
options are skipped with a warning.

Dev hook: MUSIC_LLM_DEBUG=<dir> additionally dumps bed.wav, sfx.wav (both at -6 dB, exactly as they enter the master) and
kicks.json there.
"""
import argparse
import json
import os
import subprocess
import sys
import wave
from functools import lru_cache

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, lfilter, resample_poly, sosfilt

SR = 44100
BPM = 96
BEAT = 60 / BPM            # 0.625 s
BAR = 4 * BEAT             # 2.5 s
EIGHTH = BEAT / 2
SIXTEENTH = BEAT / 4
NBARS = 24
TOTAL = NBARS * BAR        # 60.0 s
FADE_END = 59.8            # true silence from here on
FADE_EXP = 1.6
FADE_LEN = 1.6             # curved fade-out: starts at 58.2 s (gentle curve, exponent FADE_EXP), so the C add9 chord rings out instead of dropping
BED_GAIN = 1.4             # bed -> master
SFX_GAIN = .75             # sfx bus -> master (about -2.5 dB under the old mix, so the score is never behind the effects)
TARGET_LUFS = -14.0        # the wav is levelled to this before the mp3 two-pass loudnorm (which then only trims)
CEIL_DB = -2.0             # true-peak ceiling of the wav
N = int((TOTAL + 4) * SR)
F32 = np.float32
TAU = 2 * np.pi
BUS = {k: np.zeros((2, N), F32) for k in ('mus', 'bass', 'pad', 'str', 'drm', 'sfx', 'hall', 'plate', 'room', 'sfxwet')}
KICKS = []                 # (time, depth) -> sidechain of pad / strings / bass
DIPS = []                  # (time, length): short gap in the whole mix (bed + sfx) just before a big arrival
HITS = []                  # (time, depth) -> small duck of the whole bed under big sfx
KICK_LOG = []              # kick onset times (debug / verification)


# ================================================================== helpers
def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tb(bar, beat=0.0):
    return (bar * 4 + beat) * BEAT


def tv(dur):
    return np.arange(max(1, int(dur * SR))) / SR


def R(*k):
    return np.random.default_rng([abs(int(x)) % (2 ** 32) for x in k])


def nz(n, *k):
    return R(*k).standard_normal(n).astype(F32)


def put(sig, t0, bus, gain=1.0, pan=0.0, hall=0.0, plate=0.0, room=0.0, wet=0.0, fade=.03):
    """Mix a mono (panned) or stereo signal into a bus at t0 seconds, with reverb sends.
    Every waveform ends with a raised-cosine fade-out of `fade` s (so no sample is ever cut dead)."""
    if gain == 0:
        return
    sig = np.asarray(sig, F32)
    if sig.ndim == 1:
        a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * 1.4142
    nf = min(int(fade * SR), sig.shape[1] // 3)
    if nf > 1:
        w = (.5 + .5 * np.cos(np.pi * (np.arange(nf) + 1) / nf)).astype(F32)       # 1 -> 0
        sig = sig.copy()
        sig[:, -nf:] *= w
    i = int(round(t0 * SR))
    if i < 0:
        sig = sig[:, -i:]
        i = 0
    n = min(sig.shape[1], N - i)
    if n <= 0:
        return
    seg = sig[:, :n] * gain
    BUS[bus][:, i:i + n] += seg
    for k, g in (('hall', hall), ('plate', plate), ('room', room), ('sfxwet', wet)):
        if g:
            BUS[k][:, i:i + n] += seg * g


def lp(x, f, o=2):
    return sosfilt(butter(o, min(f, SR * .45), 'low', fs=SR, output='sos'), x).astype(F32)


def hp(x, f, o=2):
    return sosfilt(butter(o, max(f, 10), 'high', fs=SR, output='sos'), x).astype(F32)


def bp(x, lo, hi, o=2):
    return sosfilt(butter(o, [max(lo, 10), min(hi, SR * .45)], 'band', fs=SR, output='sos'), x).astype(F32)


def tilt(x, f=5000, top=9500):
    """tame the top of a noise: about -3 dB/oct above f (first-order shelf) plus a 9.5 kHz low-pass."""
    x = np.asarray(x, F32)
    y = .45 * x + .55 * sosfilt(butter(1, f, 'low', fs=SR, output='sos'), x)
    return lp(y.astype(F32), top, 2)


def env_s(n, att, rel, hold):
    """smoothstep attack, hold, smoothstep release (reaches exactly 0 at hold + rel)."""
    t = np.arange(n) / SR
    a = np.clip(t / max(att, 1e-4), 0, 1)
    r = 1 - np.clip((t - hold) / max(rel, 1e-4), 0, 1)
    return (a * a * (3 - 2 * a) * r * r * (3 - 2 * r)).astype(F32)


def ex(n, tau):
    return np.exp(-np.arange(n) / SR / tau).astype(F32)


def saw(f, t, det=0.0, vib=0.0, vr=5.5, ph=0.0):
    """Band-limited (polyBLEP) sawtooth, optionally with vibrato."""
    inst = f * (1 + det) * (1 + vib * np.sin(TAU * vr * t + ph)) if vib else np.full(t.shape, f * (1 + det), np.float64)
    phase = (np.cumsum(inst, dtype=np.float64) / SR + ph / TAU) % 1.0
    dt = inst / SR
    y = 2 * phase - 1
    m = phase < dt
    x = phase[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = phase > 1 - dt
    x = (phase[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y.astype(F32)


def sweep_sine(f0, f1, dur):
    t = tv(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(TAU * np.cumsum(f, dtype=np.float64) / SR).astype(F32), t


# ================================================================== instruments (cached waveforms)
@lru_cache(maxsize=None)
def v_marimba(m, dec):
    f = midi(m)
    n = int(min(dec * 7, 2.6) * SR)
    t = np.arange(n) / SR
    s = np.sin(TAU * f * t) * np.exp(-t / dec) + .30 * np.sin(TAU * f * 3.97 * t) * np.exp(-t / (dec * .22)) \
        + .10 * np.sin(TAU * f * 9.2 * t) * np.exp(-t / (dec * .07))
    k = int(.02 * SR)
    s[:k] += lp(nz(k, 1, m), 2600) * ex(k, .004) * .35
    return (s * np.minimum(1, t / .0012)).astype(F32)


@lru_cache(maxsize=None)
def v_kalimba(m, dec):
    f = midi(m)
    n = int(min(dec * 7, 3.0) * SR)
    t = np.arange(n) / SR
    s = np.sin(TAU * f * t) * np.exp(-t / dec) + .22 * np.sin(TAU * f * 5.43 * t) * np.exp(-t / (dec * .12)) \
        + .06 * np.sin(TAU * f * 12.3 * t) * np.exp(-t / (dec * .05))
    k = int(.015 * SR)
    s[:k] += bp(nz(k, 2, m), 2500, 7000) * ex(k, .003) * .25
    return (s * np.minimum(1, t / .001)).astype(F32)


@lru_cache(maxsize=None)
def v_felt(m, vel):
    """felt piano: dark, short hammer, slightly detuned string pair."""
    f = midi(m)
    n = int(4.2 * SR)
    t = np.arange(n) / SR
    tau = max(.6, 2.6 - (m - 60) * .035)
    s = np.zeros(n)
    for h in range(1, 9):
        fh = f * h * np.sqrt(1 + .00012 * 2 ** ((m - 48) / 12) * h * h)
        if fh > 9000:
            break
        a = vel ** (.6 + .3 * h) / h ** 1.5
        d = np.exp(-t / (tau / (1 + .8 * (h - 1))))
        for dc, ph in ((-.0007, 0.3 * h), (.0008, 1.1 * h)):
            s += a / 2 * np.sin(TAU * fh * (1 + dc) * t + ph) * d
    k = int(.02 * SR)
    s[:k] += lp(nz(k, 3, m), 700 + 900 * vel) * ex(k, .006) * .5 * vel
    s = lp(s.astype(F32), 2600 + 2600 * vel)
    return (s * np.minimum(1, t / .003)).astype(F32)


@lru_cache(maxsize=None)
def v_bell(m, dec, ratio, index):
    f = midi(m)
    n = int(min(dec * 5, 6) * SR)
    t = np.arange(n) / SR
    s = np.sin(TAU * f * t + index * np.exp(-t / .25) * np.sin(TAU * f * ratio * t)) * np.exp(-t / dec)
    s += .25 * np.sin(TAU * f * 2.01 * t) * np.exp(-t / (dec * .4))
    return (s * np.minimum(1, t / .002)).astype(F32)


@lru_cache(maxsize=None)
def v_pluck(m, dur):
    """saw pluck with a closing filter."""
    t = tv(dur + .25)
    f = midi(m)
    s = saw(f, t, det=.003) + saw(f, t, det=-.003)
    k = np.exp(-t / .06).astype(F32)
    s = (lp(s, 5200) * k + lp(s, 700) * (1 - k)) * env_s(len(t), .003, .12, dur)
    return (s * .5).astype(F32)


@lru_cache(maxsize=None)
def v_bass(m, dur):
    t = tv(dur + .15)
    f = midi(m)
    s = (lp(saw(f, t), 650) * .8 + np.sin(TAU * f * t)) * env_s(len(t), .004, .1, dur) * np.exp(-t / (dur * 1.3 + .2))
    return s.astype(F32)


@lru_cache(maxsize=None)
def v_sub(m, n):
    t = np.arange(n) / SR
    f = midi(m)
    s = np.tanh(1.4 * (np.sin(TAU * f * t) + .18 * np.sin(TAU * 2 * f * t)))
    return s.astype(F32)


@lru_cache(maxsize=None)
def v_cello(m, dur):
    t = tv(dur + .12)
    f = midi(m)
    s = saw(f, t, det=.002, vib=.003, vr=5.0) + saw(f, t, det=-.003, vib=.003, vr=5.4, ph=2)
    s = lp(s, 1000) * env_s(len(t), .012, .08, dur)
    return (s * .5).astype(F32)


def tone_n(dur, rel):
    return int(np.ceil((dur + rel) / .25) * .25 * SR)


@lru_cache(maxsize=None)
def tone_pad(m, n):
    t = np.arange(n) / SR
    f = midi(m)
    s = sum(saw(f, t, det=d, vib=.0025, vr=.3 + .09 * i, ph=i * 2.1) for i, d in enumerate((-.007, -.0025, .003, .008))) / 4
    s = s + .5 * np.sin(TAU * f * t)
    return lp(s, 6000)


@lru_cache(maxsize=None)
def tone_str(m, n):
    t = np.arange(n) / SR
    f = midi(m)
    s = sum(saw(f, t, det=(v - 1.5) * .0035, vib=.0035, vr=5.0 + v * .45, ph=v * 1.7) for v in range(4)) / 4
    return lp(s, 4800)


@lru_cache(maxsize=None)
def wide(kind, m, n, v):
    """stereo voice from a mono tone: everything below 150 Hz stays mono, the part above is decorrelated by a 9-19 ms
    Haas delay on one side (the delayed side alternates with v)."""
    x = (tone_pad if kind == 'pad' else tone_str)(m, n)
    lo = lp(x, 150, 2)
    hi = x - lo
    d = (9, 14, 19)[v % 3] * SR // 1000
    dl = np.concatenate([np.zeros(d, F32), hi[:-d]])
    return np.stack([lo + (hi if v % 2 == 0 else dl), lo + (dl if v % 2 == 0 else hi)]).astype(F32)


def pan2(sig, pan):
    """balance a stereo signal with the same constant-power law as put() uses for mono."""
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    return sig * np.array([[np.cos(a)], [np.sin(a)]], F32) * 1.4142


def pad(t0, notes, dur, gain=.03, att=.6, rel=.8, spread=.7, hall=0.0, bus='pad'):
    n = int((dur + rel) * SR)
    e = env_s(n, att, rel, dur)
    for i, m in enumerate(notes):
        tone = wide('pad' if bus == 'pad' else 'str', m, tone_n(dur, rel), i)[:, :n]
        put(pan2(tone * e, ((i / max(1, len(notes) - 1)) - .5) * spread), t0, bus, gain, hall=hall)


def strpad(t0, notes, dur, gain=.03, att=.6, rel=.8, spread=.8):
    pad(t0, notes, dur, gain, att, rel, spread, bus='str')


# ---- note-level instrument helpers: (t0, midi, dur, gain, pan, vel)
def i_marimba(t0, m, dur=.3, gain=.05, pan=0.0, vel=.8, dec=.32):
    put(v_marimba(m, dec) * vel, t0, 'mus', gain, pan, hall=.25, plate=.25, room=.1)


def i_kalimba(t0, m, dur=.3, gain=.05, pan=0.0, vel=.8, dec=.9):
    put(v_kalimba(m, dec) * vel, t0, 'mus', gain, pan, hall=.4, plate=.3)


def i_felt(t0, m, dur=1.0, gain=.07, pan=0.0, vel=.7):
    put(v_felt(m, round(vel, 1)), t0, 'mus', gain, pan, hall=.5, plate=.2, room=.1)


def i_bell(t0, m, dur=1.0, gain=.03, pan=0.0, vel=1.0, dec=1.4):
    put(v_bell(m, dec, 3.5, 1.4) * vel, t0, 'mus', gain, pan, hall=.9, plate=.3)


def i_pluck(t0, m, dur=.15, gain=.03, pan=0.0, vel=1.0):
    put(v_pluck(m, round(dur, 3)) * vel, t0, 'mus', gain, pan, hall=.25, plate=.3)


def i_strlead(t0, m, dur=1.0, gain=.03, pan=0.0, vel=1.0):
    n = int((dur + .35) * SR)
    put(pan2(wide('str', m, tone_n(dur, .35), int(m))[:, :n] * env_s(n, .09, .35, dur) * vel, pan), t0, 'str', gain, hall=0)


SUB_TRIM = .3 * 10 ** (-5.5 / 20)       # sub sine is 5.5 dB under the old level (it carried 45 % of all energy)


def i_subnote(t0, m, dur, gain=.2, att=.01, rel=.15):
    n = int((dur + rel) * SR)
    put(v_sub(m, tone_n(dur, rel))[:n] * env_s(n, att, rel, dur), t0, 'bass', gain * SUB_TRIM)


def i_bassnote(t0, m, dur, gain=.1, pan=0.0):
    put(v_bass(m, round(dur, 3)), t0, 'bass', gain, pan)


# ---- drums
@lru_cache(maxsize=None)
def w_kick(f0=60.0):
    t = tv(.36)
    f = f0 + 115 * np.exp(-t / .024)                       # settles on the root of the chord (see kick_hz): no beating against the sub
    s = .55 * np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .105) + .42 * hp(nz(len(t), 4), 1600) * np.exp(-t / .0035)   # less 60 Hz weight, more beater click
    return (np.tanh(1.4 * s) * np.minimum(1, t / .0008)).astype(F32)


def kick_hz(t0):
    """fundamental of the kick = the chord root (A 55, C 65, G 49 Hz; F and E an octave up so it stays audible), so it never beats the sub."""
    f = midi(ROOT[chord_at(t0)])
    while f < 46:
        f *= 2
    return round(float(f), 1)


def kick(t0, gain=.4, duck=.5):
    put(w_kick(kick_hz(t0)), t0, 'drm', gain * .75, room=.1, fade=.04)
    KICKS.append((t0, duck))
    KICK_LOG.append(round(t0, 4))


@lru_cache(maxsize=None)
def w_snare():
    t = tv(.5)
    s = tilt(bp(nz(len(t), 5), 1000, 8500)) * np.exp(-t / .12) + .5 * np.sin(TAU * 190 * t) * np.exp(-t / .055) + .25 * np.sin(TAU * 330 * t) * np.exp(-t / .035)
    return hp(s.astype(F32), 170)


@lru_cache(maxsize=None)
def w_snare_roll():
    t = tv(.3)
    return (tilt(bp(nz(len(t), 14), 1800, 9000)) * np.exp(-t / .07) + .25 * bp(nz(len(t), 15), 700, 2000) * np.exp(-t / .04)).astype(F32)


def snare(t0, gain=.16, pan=0.0, roll=False):
    put(w_snare_roll() if roll else w_snare(), t0, 'drm', gain, pan, room=.3, plate=.25)


@lru_cache(maxsize=None)
def w_clap():
    n = int(.4 * SR)
    s = np.zeros(n, F32)
    for k, d in enumerate((0, .011, .023)):
        i = int(d * SR)
        s[i:] += bp(nz(n - i, 6, k), 1100, 5200) * ex(n - i, .012 if k < 2 else .1)
    return s


def clap(t0, gain=.11):
    put(w_clap(), t0, 'drm', gain, room=.35, plate=.3)


@lru_cache(maxsize=None)
def w_hat(kind):
    t = tv({0: .06, 1: .28, 2: .03}[kind])
    return (hp(nz(len(t), 7, kind), 7000) * np.exp(-t / {0: .016, 1: .09, 2: .008}[kind])).astype(F32)


def hat(t0, gain=.03, kind=0, pan=.25):
    put(w_hat(kind), t0, 'drm', gain, pan, room=.1)


@lru_cache(maxsize=None)
def w_shaker():
    t = tv(.1)
    return (bp(nz(len(t), 8), 4200, 11000) * np.sin(np.pi * t / .1) ** 2).astype(F32)


def shaker(t0, gain=.02, pan=-.2):
    put(w_shaker(), t0, 'drm', gain, pan)


@lru_cache(maxsize=None)
def w_rim():
    t = tv(.08)
    return (np.sin(TAU * 1700 * t) * np.exp(-t / .006) + .5 * bp(nz(len(t), 9), 1500, 6000) * np.exp(-t / .004)).astype(F32)


def rim(t0, gain=.04, pan=.3):
    put(w_rim(), t0, 'drm', gain, pan, room=.3, plate=.2)


@lru_cache(maxsize=None)
def w_taiko():
    t = tv(1.2)
    f = 62 + 70 * np.exp(-t / .045)
    s = .75 * np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .45) + .3 * np.sin(TAU * np.cumsum(f * 1.58) / SR) * np.exp(-t / .2) \
        + bp(nz(len(t), 10), 150, 900) * np.exp(-t / .07) * .6
    return np.tanh(1.2 * s).astype(F32)


def taiko(t0, gain=.25, pan=0.0):
    put(w_taiko(), t0, 'drm', gain, pan, room=.3, hall=.4, fade=.12)
    KICKS.append((t0, .35))


def crash_rev(t_end, dur=1.6, gain=.06):
    t = tv(dur)
    s = tilt(hp(nz(len(t), 11, int(dur * 10)), 4500)) * ex(len(t), dur * .35)
    put(s[::-1].copy(), t_end - dur, 'drm', gain, hall=.6, fade=.004)


def crash(t0, gain=.06, dur=2.4):
    t = tv(dur)
    s = tilt(hp(nz(len(t), 12, int(dur * 10)), 4500)) * ex(len(t), dur * .3)
    put(s, t0, 'drm', gain, hall=.6, plate=.2)


def riser(t_end, dur, gain=.1, f0=200, pw=2.2):
    """noise + gliding tones that peak exactly at t_end and are cut with a 4 ms ramp (pw = steepness of the rise)."""
    t = tv(dur)
    x = t / dur
    s = tilt(hp(nz(len(t), 13, int(dur * 100)), 1200)) * x ** pw * .7
    for o in range(3):
        f = f0 * 2 ** o * 2 ** (x * 2)
        s += (np.sin(TAU * np.cumsum(f) / SR) * x ** (pw - .2) * .12 * np.sin(np.pi * np.clip(x * 1.2 - o * .1, 0, 1))).astype(F32)
    s = s.astype(F32) * np.minimum(1, (len(t) - 1 - np.arange(len(t))) / (.004 * SR))
    put(s, t_end - dur, 'mus', gain, hall=.5, fade=.004)


def snare_roll(t0, t1, g0=.03, g1=.14, step=SIXTEENTH):
    n = max(1, int(round((t1 - t0) / step)))
    for k in range(n):
        snare(t0 + k * step, g0 + (g1 - g0) * (k / max(1, n - 1)) ** 1.3, pan=.2 * np.sin(k), roll=True)


# ================================================================== harmony
# per bar: list of (beat, chord); merged when identical neighbours
CHORDS = {0: 'Am', 1: [(0, 'Am'), (1, 'F')], 2: 'Am', 3: 'F', 4: 'C', 5: 'G', 6: 'Am', 7: 'F', 8: 'G', 9: 'C', 10: 'G',
          11: 'Am', 12: 'Dm', 13: 'E', 14: 'Am', 15: 'F', 16: 'G', 17: 'C', 18: 'F', 19: 'G',
          20: 'Am', 21: 'F', 22: [(0, 'Am'), (2, 'G')], 23: 'C'}
VOIC = {'Am': [57, 60, 64, 67], 'F': [53, 57, 60, 64], 'C': [55, 60, 64, 71], 'G': [55, 59, 62, 69],
        'Dm': [53, 57, 60, 65], 'E': [52, 56, 59, 62]}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31, 'Dm': 38, 'E': 40}
PCS = {'Am': (9, 0, 4, 11), 'F': (5, 9, 0, 7), 'C': (0, 4, 7, 2), 'G': (7, 11, 2, 9), 'Dm': (2, 5, 9, 0), 'E': (4, 8, 11, 2)}


def chord_at(t):
    b = min(NBARS - 1, max(0, int(t // BAR)))
    c = CHORDS[b]
    if isinstance(c, str):
        return c
    beat = (t - b * BAR) / BEAT
    out = c[0][1]
    for bt, name in c:
        if beat >= bt - 1e-9:
            out = name
    return out


def segments(b0, b1):
    """chord segments (t0, t1, name) covering bars [b0, b1), merging identical neighbours."""
    segs = []
    for b in range(b0, b1):
        c = CHORDS[b]
        lst = [(0, c)] if isinstance(c, str) else c
        for i, (bt, name) in enumerate(lst):
            t0 = tb(b, bt)
            t1 = tb(b, lst[i + 1][0]) if i + 1 < len(lst) else tb(b + 1)
            if segs and segs[-1][2] == name and abs(segs[-1][1] - t0) < 1e-6:
                segs[-1] = (segs[-1][0], t1, name)
            else:
                segs.append((t0, t1, name))
    return segs


def pool(name, lo, hi):
    return [m for m in range(lo, hi + 1) if m % 12 in PCS[name]]


def pads(b0, b1, gain=.03, att=.8, rel=.8, lift=0, hall=0.0, voic=None):
    for t0, t1, name in segments(b0, b1):
        v = voic(name) if voic else VOIC[name]
        pad(t0, [m + lift for m in v], t1 - t0, gain, att, rel, hall=hall)


def strs(b0, b1, gain=.025, att=.9, rel=.8, low=False):
    for t0, t1, name in segments(b0, b1):
        v = VOIC[name]
        notes = [v[1] - 12, v[2], v[3]] if low else [v[0], v[1], v[2] + 12, v[3] + 12]      # low: no root (the sub and the bass own it)
        strpad(t0, notes, t1 - t0, gain, att, rel)


MOT_Q = [(0, 69, .5), (.5, 72, .5), (1, 76, 1), (2, 74, 1), (3, 76, 2.2)]    # question: hangs on the 5th
MOT_QG = [(0, 67, .5), (.5, 71, .5), (1, 74, 1), (2, 76, 1), (3, 74, 2.2)]    # question over G chords: G B D E D (E = 6th, no C against the B)
MOT_R = [(0, 69, .5), (.5, 72, .5), (1, 76, 1), (2, 74, 1), (3, 72, 4.0)]    # answer: lands on the tonic


def motif(t0, notes, inst, tr=0, gain=.05, vel=.8, pan=0.0, **kw):
    for bt, m, ln in notes:
        inst(t0 + bt * BEAT, m + tr, ln * BEAT, gain=gain, pan=pan, vel=vel * (1.0 if bt else 1.05), **kw)


def arp_bar(bar, step, patt, inst, lo, hi, gain, vel_pat=(1, .6, .8, .6), pan_w=.5, skip_chord=None, t_from=0.0, t_to=1e9, tr=0, seed=0):
    """arpeggiate the chord of this bar (or half bars); patt indexes into the chord's pool, None = rest."""
    nstep = int(round(BAR / step))
    for k in range(nstep):
        t = tb(bar) + k * step
        if t < t_from - 1e-6 or t >= t_to - 1e-6:
            continue
        p = patt[k % len(patt)]
        if p is None:
            continue
        pl = pool(chord_at(t), lo, hi)
        m = pl[p % len(pl)] + tr
        inst(t, m, step * .9, gain=gain * vel_pat[k % len(vel_pat)], pan=np.sin(k * 1.7 + bar) * pan_w, vel=.9)


def arps(b0, b1, step, patts, inst, lo, hi, gain, **kw):
    for i, b in enumerate(range(b0, b1)):
        arp_bar(b, step, patts[i % len(patts)], inst, lo, hi, gain, **kw)


P8A = [0, 2, 4, 2, 3, 2, 1, 2]
P8B = [0, 3, 2, 4, 1, 3, 2, None]
P8C = [0, 2, 1, 3, None, 4, 3, 1]
P16A = [0, 2, 4, 2, 3, 5, 4, 2, 1, 3, 5, 3, 2, 4, 3, 1]
P16B = [0, 3, 1, 4, 2, 5, 3, 6, 4, 2, 5, 3, 1, 4, 2, 0]

# ================================================================== the score
def score():
    # ------------------------------------------------ bars 0-1 (0-5 s): sparse
    for t in (tb(0, 2), tb(1, 0)):                                   # heartbeat pulse
        i_subnote(t, 33, .35, .3, att=.008, rel=.2)
        i_subnote(t + .26, 33, .3, .2, att=.008, rel=.2)
    pad(0.0, [57, 64, 67, 72], 3.125, gain=.026, att=2.4, rel=.05, spread=.8, hall=.6)       # glass swell under the typing
    strpad(0.6, [45, 57, 64], 2.52, gain=.014, att=2.0, rel=.05)
    motif(.9, MOT_Q, i_bell, tr=0, gain=.035, vel=.6, dec=1.3)                                # the question, in glass (late and quiet: the typing owns 0.5-2.2 s)
    motif(.9, MOT_Q, i_felt, tr=0, gain=.045, vel=.45)
    riser(3.125, 2.5, .055, f0=180, pw=3.2)                                                   # steeper; the last 100 ms must sit under the bloom
    DIPS.append((3.125, .08))                                                                 # 80 ms gap in the WHOLE mix (bed + sfx), released exactly at the hit
    for k in range(3):                                                                        # soft data sparkle, after the typing, running up into the riser
        i_kalimba(tb(0, 3.5 + k * .5), [88, 91, 93][k], gain=.014, pan=(k - 1) * .3, vel=.6, dec=.5)
    # title bloom, F major 7 at 3.125 (bar 1 beat 2)
    t = tb(1, 1)
    kick(t, .42, duck=.2)                                                                      # the title chord must not start under a duck
    i_subnote(t, 29, 1.6, .28, rel=.4)
    pad(t, VOIC['F'], BAR - .625 + .1, gain=.07, att=.05, rel=1.2, hall=.0)
    strpad(t, [41, 57, 64, 72, 76], 1.9, gain=.04, att=.25, rel=1.2)
    for k, m in enumerate([65, 69, 72, 76, 81, 84, 88]):
        i_bell(t + .04 + k * .085, m, gain=.057, pan=(k - 3) * .25, dec=2.2)
    crash(t, .055, 2.2)

    # ------------------------------------------------ bars 2-5 (5-15 s): curious groove
    for b in range(2, 6):
        pads(b, b + 1, gain=.022 * (1.6 if b == 4 else 1), att=1.0, rel=1.0, hall=0.0)       # bar 4 (C, low arps) was the quietest bar: about +4 dB
    for b in range(2, 6):
        r = ROOT[chord_at(tb(b))]
        i_subnote(tb(b), r, 1.5 * BEAT, .2)
        i_bassnote(tb(b, 2.5), r + 12, EIGHTH, .06)
        i_bassnote(tb(b, 3.5), r + 7 if b % 2 else r + 12, EIGHTH, .05)
        kick(tb(b), .2, .35)
        kick(tb(b, 2), .18, .3)
        for k in range(8):
            shaker(tb(b) + k * EIGHTH, .022 if k % 2 else .026, pan=-.25 + .5 * (k % 2))
            if k % 2:
                hat(tb(b) + k * EIGHTH, .022, 0)
    for b in range(2, 6):
        arp_bar(b, EIGHTH, [P8A, P8B][(b - 2) % 2], i_marimba, 60, 81, .036 * (1.8 if b == 4 else 1))
    for b in (4, 5):
        arp_bar(b, EIGHTH, [None, 1, None, 3, None, 2, None, 4], i_kalimba, 72, 93, .025 * (1.6 if b == 4 else 1))
    motif(tb(3), MOT_Q, i_kalimba, gain=.052, vel=.85, pan=.15, dec=.9)
    motif(tb(5), MOT_QG, i_marimba, tr=12, gain=.05, vel=.85, pan=-.2, dec=.4)
    for b in (3, 5):
        i_bell(tb(b, 3), 88, gain=.016, pan=.4, dec=1.6)

    # ------------------------------------------------ bars 6-8 (15-22.5): building
    for b in range(6, 9):
        pads(b, b + 1, gain=.026 * (1.3 if b == 6 else 1), att=1.0, rel=1.0)
    for i, b in enumerate(range(6, 9)):
        strs(b, b + 1, gain=.034 + .01 * i, att=1.4, rel=1.0)
        r = ROOT[chord_at(tb(b))]
        for k in range(8):
            i_bassnote(tb(b) + k * EIGHTH, r + 12 + (12 if k % 4 == 3 else 0), EIGHTH * .85, .075 + .012 * i)
        i_subnote(tb(b), r, BAR - .1, .16, rel=.2)
        for k in range(8):
            hat(tb(b) + k * EIGHTH, .02 if k % 2 else .014, 0)
        for k in (0, 2):
            kick(tb(b, k), .36 + .015 * i, .4)
        if i >= 1:
            clap(tb(b, 1), .06 + .02 * i)
            clap(tb(b, 3), .06 + .02 * i)
    arps(6, 9, SIXTEENTH, [P16A, P16B], i_marimba, 60, 88, .042, vel_pat=(1, .55, .75, .55))
    arps(6, 9, EIGHTH, [[None, 1, None, 2, None, 3, None, 4]], i_pluck, 67, 91, .036)
    motif(tb(6), MOT_Q, i_strlead, tr=0, gain=.034, vel=.8)
    motif(tb(7), MOT_Q, i_bell, tr=12, gain=.026, vel=.8, dec=1.4)
    snare_roll(tb(8, 2), tb(9), .03, .19)
    snare(tb(8, 3.5), .05)
    for k in (1, 3):
        kick(tb(8, k), .24, .35)
    riser(tb(9), 2.5, .06, f0=220)
    crash_rev(tb(9), 1.4, .048)

    # ------------------------------------------------ bars 9-10 (22.5-27.5): the aha, C major
    t = tb(9)
    kick(t, .38, .7)
    i_subnote(t, 36, 1.8, .26, rel=.4)
    crash(t, .05, 2.4)
    pads(9, 11, gain=.037, att=.06, rel=1.1)
    strs(9, 11, gain=.032, att=.15, rel=1.0)
    arps(9, 11, EIGHTH, [[None, 1, None, 3, None, 2, None, 4]], i_pluck, 62, 91, .03)
    for k, m in enumerate([72, 76, 79, 83, 88]):
        i_bell(t + k * .06, m, gain=.024, pan=(k - 2) * .25, dec=2.0)
    for b in (9, 10):
        r = ROOT[chord_at(tb(b))]
        i_subnote(tb(b), r, 1.5 * BEAT, .18)
        i_bassnote(tb(b, 2.5), r + 12, EIGHTH, .06)
        i_bassnote(tb(b, 3.5), r + 7, EIGHTH, .045)
        kick(tb(b, 2), .22, .35)
        if b == 10:
            kick(tb(b), .22, .35)
        for k in range(8):
            shaker(tb(b) + k * EIGHTH, .016 if k % 2 else .022, pan=-.25 + .5 * (k % 2))
            if k % 2:
                hat(tb(b) + k * EIGHTH, .016, 0)
        rim(tb(b, 1), .04)
        rim(tb(b, 3), .04)
        clap(tb(b, 3), .05)
        if b == 10:
            clap(tb(b, 1), .05)
    arps(9, 11, EIGHTH, [[0, 2, 4, 2, 3, 1, 4, 2], [0, 3, 2, 4, 1, 3, 5, 2]], i_marimba, 67, 91, .044)
    i_felt(tb(9, 0), 60, gain=.05, vel=.6)
    for m in (64, 67, 71):
        i_felt(tb(9, 0), m, gain=.03, vel=.55)
    motif(tb(10), MOT_QG, i_bell, tr=12, gain=.017, vel=.7, dec=1.3)
    motif(tb(10), MOT_QG, i_kalimba, tr=0, gain=.034, vel=.8, pan=.2, dec=.9)

    # ------------------------------------------------ bars 11-13 (27.5-35): dark and urgent
    pads(11, 14, gain=.024, att=.9, rel=.9)
    strs(11, 14, gain=.032, att=.6, rel=.8, low=True)
    for b in range(11, 14):
        r = ROOT[chord_at(tb(b))]
        i_subnote(tb(b), r, BAR - .05, .145, rel=.1)
        for k in range(8):
            t = tb(b) + k * EIGHTH
            i_bassnote(t, r + (24 if k % 4 == 3 else 12), EIGHTH * .8, .12 if k % 2 == 0 else .085)   # an octave over the sub: no doubling
        rr = r + 24                                                  # cello an octave above the bass saw (they stacked on 110 Hz)
        osc = (0, 0, 7, 0, 0, 7, 10, 7)
        for k in range(8):
            t = tb(b) + k * EIGHTH
            put(v_cello(rr + osc[k], round(EIGHTH * .8, 3)), t, 'mus', .095 if k % 2 == 0 else .068, pan=-.15 if k % 2 else .15, hall=.2)
        for k in range(16):
            rg = R(21, b, k)
            if rg.random() < .72:
                tt = tb(b) + k * SIXTEENTH
                hat(tt, (.02 if k % 4 == 0 else .011) * (.6 + .6 * rg.random()), 2, pan=rg.random() - .5)
        kick(tb(b), .42, .5)
        kick(tb(b, 2), .38, .45)
        if b == 13:
            kick(tb(b, 1), .2, .3)
            kick(tb(b, 3), .24, .35)
        rim(tb(b, 1), .03)
        rim(tb(b, 3), .03)
    for k, m in enumerate([81, 79, 76, 74]):                         # cold glass dots keep the sparse top
        i_kalimba(tb(11, 2 + k * .5), m, gain=.015, pan=(k - 1.5) * .3, vel=.6, dec=.7)
    i_felt(tb(12), 69, gain=.05, vel=.6)
    i_felt(tb(12, 1.5), 65, gain=.04, vel=.55)
    riser(tb(14), 1.25, .064, f0=250)

    # ------------------------------------------------ bars 14-16 (35-42.5): peak
    t = tb(14)
    kick(t, .58, .75)
    i_subnote(t, 33, 1.8, .24, rel=.3)
    crash(t, .08, 2.4)
    taiko(t, .24, -.2)
    pads(14, 17, gain=.06, att=.15, rel=.8)
    strs(14, 17, gain=.05, att=.2, rel=.8)
    for b in range(14, 17):
        r = ROOT[chord_at(tb(b))]
        for k in range(4):
            kick(tb(b, k), .56 if k else .66, .55)
        clap(tb(b, 1), .16)
        clap(tb(b, 3), .16)
        snare(tb(b, 1), .1)
        snare(tb(b, 3), .1)
        for k in range(16):
            hat(tb(b) + k * SIXTEENTH, (.038 if k % 4 == 2 else .019), 0, pan=.3 * np.sin(k))
        hat(tb(b, 3.5), .03, 1)
        for k in range(8):
            shaker(tb(b) + k * EIGHTH, .016, pan=-.3)
        i_subnote(tb(b), r, BAR - .05, .17, rel=.1)
        bl = (0, 0, 12, 0, 0, 12, 7, 12)
        for k in range(8):
            i_bassnote(tb(b) + k * EIGHTH, r + 12 + bl[k], EIGHTH * .85, .17 if k % 2 == 0 else .133)
        for k in range(8):
            t = tb(b) + k * EIGHTH
            put(v_cello(r + 24 + (0, 0, 7, 0, 0, 7, 12, 7)[k], round(EIGHTH * .8, 3)), t, 'mus', .028, pan=.2 if k % 2 else -.2, hall=.3)
    arps(14, 17, SIXTEENTH, [P16A, P16B], i_marimba, 60, 91, .058, vel_pat=(1, .55, .8, .55))
    arps(14, 17, SIXTEENTH, [P16B, P16A], i_pluck, 67, 95, .045, vel_pat=(1, .5, .75, .5), tr=0)
    motif(tb(15), MOT_Q, i_bell, tr=12, gain=.026, vel=.8, dec=1.4)
    taiko(tb(15, 3), .12, .3)
    snare_roll(tb(16, 2), tb(17), .03, .18)
    riser(tb(17), BAR, .08, f0=200)
    crash_rev(tb(17), 1.6, .064)

    # ------------------------------------------------ bars 17-19 (42.5-50): release, felt piano
    pads(17, 20, gain=.024, att=1.2, rel=1.0)
    for i, b in enumerate(range(17, 20)):
        rg = R(31, b)
        c = chord_at(tb(b))
        r = ROOT[c]
        v = VOIC[c]
        i_subnote(tb(b), r, BAR * .9, .13 + .01 * i)
        # left hand: root + fifth ; right hand: broken chord in 8ths with human jitter
        i_felt(tb(b) + rg.normal(0, .004), r + 12, gain=.052, vel=.62)
        i_felt(tb(b, 2) + rg.normal(0, .004), r + 19, gain=.04, vel=.5)
        pl = pool(c, 60, 81)
        patt = [0, 2, 1, 3, 2, 4, 3, 2] if b % 2 == 0 else [0, 3, 2, 4, 1, 3, 2, 5]
        for k in range(8):
            if b == 18 and k in (0, 1, 2, 3, 4, 5, 6, 7) and False:
                continue
            tt = tb(b) + k * EIGHTH + rg.normal(0, .005)
            i_felt(tt, pl[patt[k] % len(pl)], gain=.036, pan=np.sin(k + b) * .3, vel=.42 + .22 * (k % 2 == 0) + .05 * rg.random())
    motif(tb(17, 0) + .004, MOT_Q, i_felt, tr=0, gain=.058, vel=.78)                  # Q again, on piano, over C
    motif(tb(18, 0) + .004, MOT_Q, i_felt, tr=0, gain=.058, vel=.78)                  # and over F
    motif(tb(19, 0) + .004, MOT_QG, i_kalimba, tr=12, gain=.045, vel=.8, dec=.9)
    strs(18, 20, gain=.016, att=1.3, rel=1.0)
    arps(18, 20, EIGHTH, [[None, 1, None, 3, None, 2, None, 4]], i_kalimba, 72, 93, .022)
    for b in range(17, 20):
        kick(tb(b), .2 + .02 * (b - 17), .35)
        if b >= 18:
            kick(tb(b, 2), .17, .3)
            for k in range(8):
                shaker(tb(b) + k * EIGHTH, .014, pan=-.2 + .4 * (k % 2))
        if b >= 19:
            for k in range(8):
                hat(tb(b) + k * EIGHTH, .014 if k % 2 else .01, 0)
            clap(tb(b, 1), .045)
            clap(tb(b, 3), .06)
        rim(tb(b, 3), .02)
    riser(tb(20), 1.5, .04, f0=260)

    # ------------------------------------------------ bars 20-23 (50-60 s): finale
    # bar 20: pad swell + the motif, resolved
    pad(tb(20), VOIC['Am'], BAR + .2, gain=.034, att=2.0, rel=.9)
    strpad(tb(20), [45, 57, 64, 72, 76], BAR + .2, gain=.026, att=2.0, rel=.9)
    i_subnote(tb(20), 33, BAR, .17, att=.5)
    motif(tb(20, 0), MOT_R, i_strlead, tr=0, gain=.045, vel=.9)
    motif(tb(20, 0), MOT_R, i_bell, tr=12, gain=.022, vel=.8, dec=1.6)
    motif(tb(20, 0), MOT_R, i_felt, tr=0, gain=.055, vel=.7)
    snare_roll(tb(20, 2), tb(21), .02, .12, step=EIGHTH / 2 if False else SIXTEENTH)
    riser(tb(21), 1.25, .064, f0=300)
    crash_rev(tb(21), 1.4, .048)
    # bars 21-22: full beat
    t = tb(21)
    kick(t, .5, .75)
    taiko(t, .2, .2)
    crash(t, .07, 2.6)
    i_subnote(t, 29, 1.8, .25, rel=.3)
    pads(21, 23, gain=.033, att=.1, rel=.8)
    strs(21, 23, gain=.029, att=.15, rel=.9)
    for b in (21, 22):
        for k in range(4):
            kick(tb(b, k), .30 if k else .38, .55)
        clap(tb(b, 1), .09)
        clap(tb(b, 3), .09)
        for k in range(16):
            hat(tb(b) + k * SIXTEENTH, (.03 if k % 4 == 2 else .015), 0, pan=.3 * np.sin(k))
        hat(tb(b, 3.5), .028, 1)
        for k in range(8):
            shaker(tb(b) + k * EIGHTH, .014, pan=-.3)
    for t0, t1, name in segments(21, 23):
        r = ROOT[name]
        i_subnote(t0, r, t1 - t0 - .05, .15, rel=.1)
        bl = (0, 0, 12, 0, 0, 12, 7, 12)
        for k in range(int(round((t1 - t0) / EIGHTH))):
            i_bassnote(t0 + k * EIGHTH, r + 12 + bl[k % 8], EIGHTH * .85, .09 if k % 2 == 0 else .07)
    arps(21, 23, SIXTEENTH, [P16A, P16B], i_marimba, 60, 91, .03, vel_pat=(1, .55, .8, .55))
    arps(21, 23, EIGHTH, [[None, 1, None, 2, None, 3, None, 4]], i_pluck, 67, 95, .024)
    motif(tb(21, 0), MOT_R, i_strlead, tr=0, gain=.05, vel=.95)
    motif(tb(21, 0), MOT_R, i_bell, tr=12, gain=.028, vel=.9, dec=1.6)
    motif(tb(22, 1), MOT_R, i_strlead, tr=0, gain=.055, vel=1.0)
    motif(tb(22, 1), MOT_R, i_bell, tr=12, gain=.03, vel=.95, dec=2.0)
    motif(tb(22, 1), MOT_R, i_felt, tr=-12, gain=.06, vel=.75)
    taiko(tb(22, 0), .14, -.2)
    taiko(tb(22, 2), .11, .2)
    snare_roll(tb(22, 2), tb(23), .03, .13)
    crash_rev(tb(23), 1.0, .048)
    # bar 23: the long tonic chord, rings and fades
    t = tb(23)
    kick(t, .42, .7)
    i_subnote(t, 36, 2.2, .3, rel=1.0)
    crash(t, .045, 2.2)
    pad(t, [48, 55, 60, 64, 71, 74], 2.2, gain=.04, att=.1, rel=1.7, spread=.9)
    strpad(t, [48, 60, 67, 76, 79, 83], 2.2, gain=.03, att=.2, rel=1.7)
    for k, m in enumerate([48, 55, 64, 71, 74, 79]):
        i_felt(t + k * .03, m, gain=.07, pan=(k - 2.5) * .15, vel=.7)
    for k, m in enumerate([88, 83, 79, 76, 91, 86, 83, 95]):
        i_bell(t + .35 + k * .22, m, gain=.026 - k * .0012, pan=(k % 4 - 1.5) * .3, dec=2.6)


# ================================================================== sound effects from the cue sheet
PENT_PC = (9, 0, 2, 4, 7)                  # A minor pentatonic
PENT_E = (9, 11, 2, 4, 8)                  # over the E7 of bar 13: G natural would clash with the G#, so A B D E G#
LAST_SNAP = {}


def snap(m, t=None, key=None):
    """snap a cue pitch to the pentatonic of the chord sounding at t (A C D E G, or A B D E G# over E7); consecutive
    cues of the same name never end up on the same pitch unless the sheet asked for the same pitch twice."""
    raw = int(round(m))
    pcs = PENT_E if (t is not None and chord_at(t) == 'E') else PENT_PC
    out = raw
    for d in (0, -1, 1, -2, 2):
        if (raw + d) % 12 in pcs:
            out = raw + d
            break
    if key is not None:
        lr, ls = LAST_SNAP.get(key, (None, None))
        if lr == raw:
            out = ls                                                         # the sheet repeats a pitch: repeat it
        elif ls == out:
            while (out % 12) not in pcs or out == ls:                       # next scale tone upward
                out += 1
        LAST_SNAP[key] = (raw, out)
    return out


def pick(seq, t, salt=0):
    return seq[int(round(t * 16) + salt) % len(seq)]


def whoosh_sig(dur, lo=300, hi=3000, rev=False, seed=0):
    """noise sweep.  Normal: low -> high -> low with a symmetric swell.  rev: the sweep only rises and the amplitude
    builds slowly and ends abruptly (a reversed-cymbal build), so it is audibly 'reversed'; it ends at t + dur."""
    t = tv(dur)
    x = t / dur
    n = nz(len(t), 40, seed)
    if rev:
        k = x.astype(F32) ** 1.3
        s = bp(n, lo, lo * 3) * (1 - k) + bp(n, hi / 3, hi) * k
        s *= x ** 2.2 * np.minimum(1, (len(t) - 1 - np.arange(len(t))) / (.006 * SR))
        return s.astype(F32)
    k = np.sin(np.pi * x).astype(F32)
    s = bp(n, lo, lo * 3) * (1 - k) + bp(n, hi / 3, hi) * k
    s *= np.sin(np.pi * x) ** 1.5
    return s.astype(F32)


@lru_cache(maxsize=None)
def w_type(v):
    t = tv(.06)
    s = bp(nz(len(t), 41, v), 1500 + 200 * v, 4200) * np.exp(-t / .0045) * .75 + .7 * np.sin(TAU * (140 + 18 * v) * t) * np.exp(-t / .014)
    return s.astype(F32)


# per-cue trims (linear) relative to the original balance; the sfx bus itself is SFX_GAIN under the bed
T_TYPE = 1.4
T_TICK = 10 ** (-3 / 20)
T_BLIP = 1.0
T_POP = 10 ** (8.5 / 20)
T_PING = 10 ** (3 / 20)
T_SWELL = 10 ** (5 / 20)          # the swell sits on top of the pad: it needs a real tonal body
T_LOUD = 1 / SFX_GAIN        # hit / boom / stamp / glitch keep their old absolute level


def fx_type(t, g=1.0, **o):
    v = int(t * 997) % 5
    put(w_type(v), t, 'sfx', .38 * T_TYPE * g, ((v - 2) * .08), wet=.08)


@lru_cache(maxsize=None)
def w_chip(m):
    f = midi(m)
    t = tv(.3)
    fr = f * (1 + .6 * np.exp(-t / .012))
    s = np.sin(TAU * np.cumsum(fr) / SR) * np.exp(-t / .1) + .35 * np.sin(TAU * f * 4.2 * t) * np.exp(-t / .025)
    s[:200] += bp(nz(200, 42, m), 2500, 8000) * np.exp(-np.arange(200) / SR / .002) * .4
    return (s * np.minimum(1, t / .0008)).astype(F32)


def fx_chip(t, midi_=None, g=1.0, **o):
    m = snap(midi_, t, 'chip') if midi_ is not None else pick([72, 74, 76, 79, 81, 84], t)
    put(w_chip(m), t, 'sfx', .22 * g, np.sin(m * 1.3) * .4, wet=.3)


@lru_cache(maxsize=None)
def w_tick(hi):
    t = tv(.045)
    s = np.sin(TAU * (3400 if hi else 2400) * t) * np.exp(-t / .004) * .8 + .3 * hp(nz(len(t), 43, int(hi)), 4000) * np.exp(-t / .0025)
    return s.astype(F32)


def fx_tick(t, hi=True, g=1.0, **o):
    put(w_tick(bool(hi)), t, 'sfx', .22 * T_TICK * g, .15 if hi else -.15, wet=.12)


@lru_cache(maxsize=None)
def w_pop():
    t = tv(.16)
    f = 380 * (1 + 2.2 * (1 - np.exp(-t / .012)))
    return (np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .045) * np.minimum(1, t / .0008)).astype(F32)


def fx_pop(t, g=1.0, **o):
    put(w_pop(), t, 'sfx', .17 * T_POP * g, np.sin(t * 17) * .4, wet=.25)


@lru_cache(maxsize=None)
def w_blip(m):
    t = tv(.22)
    fr = midi(m) * (1 + .3 * np.exp(-t / .02))
    s = np.tanh(2.2 * np.sin(TAU * np.cumsum(fr) / SR)) * np.exp(-t / .07)
    return lp(s.astype(F32), 6000) * np.minimum(1, t / .001).astype(F32)


def fx_blip(t, midi_=None, g=1.0, **o):
    m = snap(midi_, t, 'blip') if midi_ is not None else pick([67, 72, 74, 76, 79, 81], t, 1)
    put(w_blip(m), t, 'sfx', .34 * T_BLIP * g, np.sin(m) * .5, wet=.25)


@lru_cache(maxsize=None)
def w_glass(m):
    f = midi(m)
    t = tv(2.2)
    s = sum(a * np.sin(TAU * f * r * t + ph) * np.exp(-t / d) for r, d, a, ph in ((1, 1.1, 1, 0), (2.32, .6, .45, 1), (4.25, .35, .25, 2), (6.63, .2, .15, 3), (1.003, 1.1, .5, 4)))
    return (s * np.minimum(1, t / .002)).astype(F32)


def fx_ping(t, midi_=None, g=1.0, **o):
    m = snap(midi_, t, 'ping') if midi_ is not None else pick([84, 88, 91, 93, 96], t, 2)
    put(w_glass(m), t, 'sfx', .1 * T_PING * g, np.sin(m * .9) * .5, wet=.8, fade=.15)


def fx_whoosh(t, dur=1.0, rev=0, g=1.0, **o):
    dur = float(np.clip(dur, .15, 6))
    s = whoosh_sig(dur, 250, 3500, bool(rev), seed=int(dur * 10))
    pan = np.linspace(-.6, .6, len(s))
    a = (pan + 1) * np.pi / 4
    put(np.stack([s * np.cos(a), s * np.sin(a)]) * 1.41, t, 'sfx', .31 * g, wet=.35, fade=.006 if rev else .03)   # t = start of the sweep


def fx_swish(t, pitch=1.0, g=1.0, **o):
    pitch = float(np.clip(pitch, .4, 2.5))
    put(whoosh_sig(.34, 900 * pitch, 7000 * pitch, seed=3), t - .06, 'sfx', .26 * g, .3, wet=.3)


@lru_cache(maxsize=None)
def w_hit():
    t = tv(1.4)
    f = 46 + 70 * np.exp(-t / .03)
    s = np.tanh(2 * np.sin(TAU * np.cumsum(f) / SR)) * np.exp(-t / .3)
    s += .35 * np.sin(TAU * 52 * t) * np.exp(-t / .6)
    s += .5 * hp(nz(len(t), 44), 1800) * np.exp(-t / .03) + .3 * lp(nz(len(t), 45), 900) * np.exp(-t / .12)
    return s.astype(F32)


def fx_hit(t, k=.6, g=1.0, **o):
    k = float(np.clip(k, 0, 1.2))
    put(w_hit(), t, 'sfx', .62 * T_LOUD * k * g, wet=.35, fade=.12)
    tt = tv(1.2)
    met = sum(np.sin(TAU * f * tt) * np.exp(-tt / d) for f, d in ((1390, .3), (2310, .2), (3710, .12)))
    put(met, t, 'sfx', .04 * T_LOUD * k * g, wet=.6, fade=.1)
    put(whoosh_sig(.22, 800, 6000, rev=True, seed=7), t - .22, 'sfx', .12 * T_LOUD * k * g, fade=.006)
    HITS.append((t, .38 * k))
    KICKS.append((t, .35 * k))


def fx_boom(t, g=1.0, **o):
    s, tt = sweep_sine(70, 38, 2.6)
    put(np.tanh(1.6 * s) * np.exp(-tt / .8), t, 'sfx', .62 * T_LOUD * g, wet=.4, fade=.2)
    put(lp(nz(len(tt), 46), 400) * np.exp(-tt / .4), t, 'sfx', .15 * T_LOUD * g, wet=.6, fade=.2)
    HITS.append((t, .35))


def fx_thump(t, g=1.0, **o):
    for d, gg in ((0, 1), (.28, .6)):
        s, tt = sweep_sine(64, 38, .35)
        put(s * np.exp(-tt / .12), t + d, 'sfx', .5 * T_LOUD * gg * g, wet=.2)
    HITS.append((t, .12))


def fx_riser(t, dur=1.6, g=1.0, **o):
    dur = float(np.clip(dur, .2, 8))
    tt = tv(dur)
    x = tt / dur
    s = tilt(hp(nz(len(tt), 47, int(dur * 100)), 1500)) * x ** 2.4 * .6
    for i, f0 in enumerate((330, 495, 660)):
        f = f0 * 2 ** (x * 1.6)
        s += np.sin(TAU * np.cumsum(f) / SR).astype(F32) * x ** 2 * .12
    s = s.astype(F32) * np.minimum(1, (len(tt) - 1 - np.arange(len(tt))) / (.004 * SR))
    put(s, t, 'sfx', .25 * g, wet=.5, fade=.004)


def fx_swell(t, dur=1.5, g=1.0, **o):
    dur = float(np.clip(dur, .2, 8))
    g *= T_SWELL
    tt = tv(dur)
    x = tt / dur
    c = chord_at(t + dur)
    end = np.minimum(1, (len(tt) - 1 - np.arange(len(tt))) / (.03 * SR)).astype(F32)
    put(lp(nz(len(tt), 48, int(dur * 100)), 2600) * x ** 3 * end, t, 'sfx', .1 * g, wet=.7)
    for m in VOIC[c][1:] + [VOIC[c][0] + 12]:                              # a real chord (two octaves of the voicing) so it sits above the pad
        for o, ga in ((12, 1.0), (24, .5)):
            put(np.sin(TAU * midi(m + o) * tt) * x ** 1.8 * end, t, 'sfx', .07 * ga * g, wet=1.0)


def fx_sparkle(t, dur=1.5, g=1.0, **o):
    dur = float(np.clip(dur, .2, 6))
    r = R(49, int(t * 100))
    for i in range(int(dur * 22)):
        u = r.random()
        m = [84, 88, 91, 93, 96, 100][r.integers(6)]
        put(w_glass(m)[:int(.5 * SR)] * ex(int(.5 * SR), .12), t + u * dur, 'sfx', .035 * g * np.sin(np.pi * u) ** .5, r.random() * 1.6 - .8, wet=.8)


def fx_shimmer(t, g=1.0, **o):
    tt = tv(4.0)
    s = sum(np.sin(TAU * 1760 * r_ * tt * (1 + .002 * np.sin(TAU * 5 * tt))) * np.exp(-tt / d) for r_, d in ((1, 2.0), (2.0, 1.4), (3.0, .9), (4.5, .5)))
    put(s * np.minimum(1, tt / .01), t, 'sfx', .045 * g, wet=.9, fade=.3)
    fx_sparkle(t, 1.0, g=1.0)
    HITS.append((t, .15))


@lru_cache(maxsize=None)
def w_bell(m, dec, index):
    return v_bell(m, dec, 3.5, index)


def fx_chime(t, midi_=None, g=1.0, **o):
    m = snap(midi_, t, 'chime') if midi_ is not None else pick([84, 88, 91], t)
    put(w_bell(m, 2.4, 1.4), t, 'sfx', .11 * g, np.sin(m) * .3, wet=.8, fade=.1)


def fx_ding(t, midi_=None, g=1.0, **o):
    m = snap(midi_, t, 'ding') if midi_ is not None else pick([81, 84, 88], t, 1)
    put(w_bell(m, 1.1, 2.2), t, 'sfx', .12 * g, np.sin(m) * .3, wet=.6, fade=.1)


@lru_cache(maxsize=None)
def w_down():
    t = tv(.34)
    f = 330 * (.42 ** (t / .3)) + 0
    s = np.sin(TAU * np.cumsum(f) / SR) + .5 * np.sign(np.sin(TAU * np.cumsum(f * 1.5) / SR)) * .3
    return (lp(s.astype(F32), 1300, 4) * np.exp(-t / .16) * np.minimum(1, t / .002)).astype(F32)


def fx_down(t, g=1.0, **o):
    put(w_down(), t, 'sfx', .3 * g, -.1, wet=.25)


def fx_up(t, g=1.0, **o):
    put(w_bell(79, .9, 1.1), t, 'sfx', .1 * g, -.15, wet=.6, fade=.1)
    put(w_bell(84, 1.5, 1.1), t + .11, 'sfx', .11 * g, .15, wet=.7, fade=.1)


@lru_cache(maxsize=None)
def w_step(v):
    t = tv(.03)
    s = bp(nz(len(t), 50, v), 2200 + 350 * v, 7500) * np.exp(-t / .0025) + 1.15 * np.sin(TAU * (1850 + 70 * v) * t) * np.exp(-t / .005)   # tonal tick at 1.8-2.4 kHz: it stands out from the hats
    return s.astype(F32)


def fx_step(t, g=1.0, **o):
    v = int(t * 1013) % 8
    put(w_step(v), t, 'sfx', .2 * g, (v - 3.5) * .07, wet=.05)


def fx_scan(t, dur=1.5, g=1.0, **o):
    dur = float(np.clip(dur, .2, 8))
    tt = tv(dur)
    x = tt / dur
    f = 700 * 2 ** (x * 2.2)
    s = np.sin(TAU * np.cumsum(f) / SR + 1.5 * np.sin(TAU * 9 * tt)) * .6 + .3 * bp(nz(len(tt), 51, int(dur * 10)), 2500, 6000)
    put((s * np.minimum(1, tt / .05) * np.minimum(1, (dur - tt) / .1)).astype(F32), t, 'sfx', .13 * g, wet=.35)


@lru_cache(maxsize=None)
def w_stamp():
    s, tt = sweep_sine(110, 48, .5)
    return (s * np.exp(-tt / .12) + bp(nz(len(tt), 52), 200, 900) * np.exp(-tt / .05) + .6 * hp(nz(len(tt), 53), 2000) * np.exp(-tt / .018)).astype(F32)


def fx_stamp(t, g=1.0, **o):
    put(w_stamp(), t, 'sfx', .42 * T_LOUD * g, .1, wet=.3, fade=.08)
    HITS.append((t, .25))


@lru_cache(maxsize=None)
def w_glitch(v):
    t = tv(.22)
    s = np.round(nz(len(t), 54, v) * 3) / 3 * (np.sin(TAU * (30 + 8 * v) * t) > 0).astype(F32)
    s = bp(s.astype(F32), 500, 6500)
    return (s * np.minimum(1, (len(t) - 1 - np.arange(len(t))) / (.01 * SR)).astype(F32))


def fx_glitch(t, g=1.0, **o):
    v = int(t * 31) % 3
    put(w_glitch(v), t, 'sfx', .42 * T_LOUD * g, wet=.2)
    r = R(55, int(t * 100))
    for i in range(3):
        put(w_tick(bool(r.integers(2))), t + .04 * i + r.random() * .02, 'sfx', .1 * T_LOUD * g, r.random() - .5)


def fx_count(t, dur=1.5, g=1.0, **o):
    dur = float(np.clip(dur, .2, 8))
    tk = 0.0
    while tk < dur:
        x = tk / dur
        v = int((t + tk) * 997) % 4
        put(w_tick(v % 2 == 0), t + tk, 'sfx', .26 * g * (.5 + .7 * x), np.sin(tk * 7) * .3, wet=.1)
        tk += 1 / (7 + 24 * x ** 1.2)


FX = {k[3:]: v for k, v in sorted(globals().items()) if k.startswith('fx_')}
CUE_NAMES = ['type', 'chip', 'tick', 'pop', 'blip', 'ping', 'whoosh', 'swish', 'hit', 'boom', 'thump', 'riser', 'swell', 'sparkle',
             'shimmer', 'chime', 'ding', 'down', 'up', 'step', 'scan', 'stamp', 'glitch', 'count']


def place_cues(cues):
    placed = 0
    warned = set()
    LAST_SNAP.clear()

    def tkey(c):
        try:
            return float(c.get('t'))
        except (AttributeError, TypeError, ValueError):
            return 0.0
    for c in sorted(cues, key=tkey):                                   # time order, so pitch de-duplication is well defined
        if not isinstance(c, dict):
            continue
        name = c.get('name')
        try:
            t = float(c.get('t'))
        except (TypeError, ValueError):
            print(f'warning: cue without a valid time skipped: {c!r}'[:120], file=sys.stderr)
            continue
        if not np.isfinite(t) or t < 0 or t >= TOTAL:
            continue
        if name not in FX:
            if name not in warned:
                print(f'warning: unknown cue name {name!r} skipped', file=sys.stderr)
                warned.add(name)
            continue
        o = {}
        for k, v in c.items():
            if k in ('t', 'name') or v is None:
                continue
            if k == 'midi':
                try:
                    v = float(v)
                except (TypeError, ValueError):
                    print(f'warning: bad {k}={v!r} in {name} cue at {t}; ignored', file=sys.stderr)
                    continue
                k = 'midi_'
            elif k in ('dur', 'pitch', 'k'):
                try:
                    v = float(v)
                except (TypeError, ValueError):
                    print(f'warning: bad {k}={v!r} in {name} cue at {t}; default used', file=sys.stderr)
                    continue
                if not np.isfinite(v):
                    print(f'warning: non-finite {k} in {name} cue at {t}; default used', file=sys.stderr)
                    continue
            elif k in ('hi', 'rev'):
                v = bool(v)
            elif k == 'gain':
                try:
                    k, v = 'g', float(np.clip(float(v), 0, 2))
                except (TypeError, ValueError):
                    print(f'warning: bad gain={v!r} in {name} cue at {t}; ignored', file=sys.stderr)
                    continue
            o[k] = v
        try:
            FX[name](t, **o)
            placed += 1
        except Exception as e:                                         # a bad option must never kill the render
            print(f'warning: cue {name!r} at {t} failed ({e}); skipped', file=sys.stderr)
    return placed


# ================================================================== mix + master
def make_ir(bands, dur, pre, seed, er=8):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        x = r.standard_normal(n).astype(F32)
        y = np.zeros(n, F32)
        for (lo, hi), tau in bands:
            y += (bp(x, lo, hi) if lo else lp(x, hi)) * np.exp(-t / tau)
        y *= np.minimum(1, t / .008)
        for k in range(er):
            y[int((.003 + r.random() * .05) * SR)] += (.6 - k * .05) * (1 if r.random() < .5 else -1)
        y = np.concatenate([np.zeros(int(pre * SR), F32), y])
        out.append(y / np.sqrt(np.sum(y ** 2)))
    return out


def conv(sig, h):
    return np.stack([fftconvolve(sig[c], h[c])[:N].astype(F32) for c in range(2)])


def sweep_lp(x, pts, k=9):
    """time-varying low-pass (bank of fixed filters, cross-faded); pts = [(t, hz)]."""
    cs = np.geomspace(250, 14000, k)
    tt = np.arange(N) / SR
    hz = np.exp(np.interp(tt, [p[0] for p in pts], np.log([p[1] for p in pts])))
    pos = np.clip((np.log(hz) - np.log(cs[0])) / np.log(cs[1] / cs[0]), 0, k - 1.0001)
    out = np.zeros_like(x)
    for i in range(k):
        w = np.maximum(0, 1 - np.abs(pos - i)).astype(F32)
        if not w.any():
            continue
        y = np.stack([lp(x[c], cs[i], 2) for c in range(2)])
        out += y * w
    return out


PAD_CUT = [(0, 600), (2.5, 1100), (3.1, 1600), (3.2, 5500), (5, 2600), (14, 2800), (15, 1800), (22.4, 9000), (22.6, 7000), (27.4, 6000),
           (27.5, 1300), (34, 2200), (35, 4500), (42.4, 7000), (42.5, 2400), (49.9, 3800), (50, 1500), (52.4, 5500), (52.5, 6500), (57.4, 6500), (57.5, 5000), (60, 3000), (64, 3000)]
STR_CUT = [(0, 1500), (3.1, 2500), (3.2, 6500), (5, 3500), (15, 2200), (22.4, 9000), (27.4, 6500), (27.5, 1800), (35, 6000), (42.5, 3000), (50, 2000), (52.5, 7000), (57.5, 6000), (64, 3500)]


def duck_curve(events, tau, floor_len=.5):
    d = np.zeros(N, F32)
    for t, depth in events:
        i = int(t * SR)
        L = min(int(floor_len * SR), N - i)
        if L > 0:
            d[i:i + L] = np.maximum(d[i:i + L], depth * np.exp(-np.arange(L) / SR / tau))
    return uniform_filter1d(d, int(.004 * SR)) if len(events) else d


MUS_GAIN = 1.4            # melodic bus +3 dB (it sat 16-20 dB under the bass)


def hp_st(x, f, o=2):
    return np.stack([hp(x[c], f, o) for c in range(2)])


def bp_st(x, lo, hi, o=2):
    return np.stack([bp(x[c], lo, hi, o) for c in range(2)])


def dip_gain(depth=.25, att=.008, rel=.006):
    """gain curve of the gaps right before big arrivals (DIPS): -12 dB for the last `ln` seconds, 8 ms smooth edge in, `rel`
    ramp that is back at exactly unity on the hit itself.  Applied to the final bed AND sfx sum."""
    g = np.ones(N, F32)
    for t, ln in DIPS:
        a, b = int(round((t - ln) * SR)), int(round(t * SR))
        na, nr = int(att * SR), int(rel * SR)
        w = np.ones(b - a, F32)
        w[:na] = .5 - .5 * np.cos(np.pi * (np.arange(na) + 1) / na)
        w[-nr:] = np.minimum(w[-nr:], .5 + .5 * np.cos(np.pi * (np.arange(nr) + 1) / nr))
        g[a:b] = 1 - (1 - depth) * w
    return g


def render_mix():
    HALL = make_ir([((0, 300), 1.3), ((300, 1500), 1.1), ((1500, 5000), .75), ((5000, 16000), .35)], 3.4, .025, 1)
    PLATE = make_ir([((0, 500), .55), ((500, 4000), .6), ((4000, 16000), .45)], 1.7, .008, 2)
    ROOM = make_ir([((0, 400), .18), ((400, 6000), .16), ((6000, 16000), .08)], .7, .004, 3)
    pad_f = sweep_lp(BUS['pad'], PAD_CUT)
    str_f = sweep_lp(BUS['str'], STR_CUT)
    wet = conv(BUS['hall'] + pad_f * .55 + str_f * .45, HALL) * .5 + conv(BUS['plate'], PLATE) * .5 + conv(BUS['room'], ROOM) * .6
    wet = hp_st(wet, 170)                                           # reverb returns carry no low end (it only made 125-500 Hz muddy)
    wet_sfx = hp_st(conv(BUS['sfxwet'], PLATE) * .7, 150)
    kd = duck_curve(KICKS, .16)
    dg = dip_gain()
    mus = BUS['mus'] + .75 * bp_st(BUS['mus'], 1500, 9000, 1) + .3 * bp_st(BUS['mus'], 4000, 10000, 1)   # presence shelf on the melodic bus: about +4 dB at 2 kHz rising to +6 dB at 5-8 kHz
    drm = BUS['drm'] * .9
    drm = drm + .5 * bp_st(drm, 3500, 9000, 1)                           # hats, shakers and clicks sat 20 dB down at 4-16 kHz
    bed = mus * MUS_GAIN + BUS['bass'] * (1 - .55 * kd) + pad_f * (1 - .5 * kd) + str_f * (1 - .4 * kd) + wet + drm
    hd = duck_curve(HITS, .3, 1.0)
    bed = bed * (1 - hd)
    return bed * dg, (BUS['sfx'] + wet_sfx) * dg


def limiter(x, ceil_db=CEIL_DB, look=.004, rel=.09):
    """true-peak aware look-ahead limiter: peaks are found on a 4x oversampled copy, the gain reduction is anticipated
    over `look` and ramped (no gain steps), and recovers with a one-pole release.  Starts at unity gain."""
    ceil = 10 ** (ceil_db / 20)
    n0 = x.shape[1]
    pk = np.max(np.abs(x), axis=0)
    for c in range(2):
        up = np.abs(resample_poly(x[c].astype(np.float64), 4, 1)).astype(F32)
        pk = np.maximum(pk, up.reshape(-1, 4).max(axis=1)[:n0])
    ar = np.maximum(0, 1 - ceil / np.maximum(pk, 1e-9)).astype(np.float64)         # required gain reduction
    L = max(2, int(look * SR))
    a1 = uniform_filter1d(maximum_filter1d(ar, 2 * L + 1), L + 1)                   # >= ar everywhere, continuous attack ramp
    r = float(np.exp(-1 / (rel * SR)))
    e = np.empty_like(a1)
    prev = 0.0
    for n, v in enumerate(a1.tolist()):                                              # instant attack (already ramped), exp. release
        prev = v if v > prev * r else prev * r
        e[n] = prev
    return x * (1 - e).astype(F32)


def master(bed, sfx):
    """bed + sfx -> glue-compressed stereo mix (not yet levelled, see finish())."""
    mix = bed * BED_GAIN + sfx * SFX_GAIN
    mix = np.stack([hp(mix[c], 28) for c in range(2)])
    # glue compression
    mono = np.sqrt((mix[0] ** 2 + mix[1] ** 2) / 2)
    a = np.exp(-1 / (.12 * SR))
    env = np.sqrt(lfilter([1 - a], [1, -a], mono ** 2) + 1e-12)
    ref = np.percentile(env[:int(TOTAL * SR)], 99)
    lvl = 20 * np.log10(env / (ref + 1e-9) + 1e-9)
    g = 10 ** (-np.maximum(0, lvl + 3) * (1 - 1 / 2.0) / 20)
    mix = mix * g.astype(F32)
    return mix[:, :int(TOTAL * SR)]


def lufs(mix, tmp):
    """integrated loudness (ffmpeg loudnorm measurement of a temporary wav)."""
    write_wav(tmp, mix)
    try:
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
                            '-f', 'null', '-'], capture_output=True, text=True).stderr
        return float(json.loads(r[r.rindex('{'):r.rindex('}') + 1])['input_i'])
    finally:
        os.remove(tmp)


def finish(mix, tmp):
    """level to TARGET_LUFS with the true-peak limiter at CEIL_DB, then the 4 ms fade-in and the curved fade-out to true
    silence at FADE_END (the fade only ever lowers the level, so the ceiling holds).  No peak-normalisation reference is used."""
    t = np.arange(mix.shape[1]) / SR
    fo = np.clip((FADE_END - t) / FADE_LEN, 0, 1)
    fade = ((0.5 - 0.5 * np.cos(np.pi * fo)) ** FADE_EXP).astype(F32) * np.minimum(1, t / .004).astype(F32)
    g = 10 ** (-14 / 20) / np.sqrt(np.mean(mix ** 2) + 1e-12) * .35
    y = mix
    for _ in range(4):
        y = limiter(mix * F32(g)) * fade
        y[:, t >= FADE_END] = 0
        L = lufs(y, tmp)
        if abs(L - TARGET_LUFS) < .12:
            break
        g *= 10 ** ((TARGET_LUFS - L) / 20)
    return y


def write_wav(path, mix):
    pcm = np.round(np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav, mp3):
    LN = 'loudnorm=I=-14:TP=-2:LRA=11'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', LN + ':print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    LN += (f":measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
           f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', LN + ',alimiter=limit=-2.3dB:level=false,atrim=0:60,apad=whole_dur=60',
                    '-ar', str(SR), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '256k', mp3], check=True)
    return m


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--cues', default=os.path.join(here, 'cues.json'), help='cue sheet JSON: [{"t": seconds, "name": cue, ...opts}]')
    ap.add_argument('--out-dir', default=here, help='directory for music.wav and music.mp3')
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)

    score()
    cues = []
    try:
        with open(a.cues, encoding='utf-8') as f:
            cues = json.load(f)
        if not isinstance(cues, list):
            print('warning: cue sheet is not a list; ignoring it', file=sys.stderr)
            cues = []
    except FileNotFoundError:
        print(f'warning: cue sheet {a.cues} not found; rendering the score without sound effects', file=sys.stderr)
    except json.JSONDecodeError as e:
        print(f'warning: cue sheet unreadable ({e}); rendering the score without sound effects', file=sys.stderr)
    n = place_cues(cues)
    print(f'score placed; {n} of {len(cues)} sound cues placed; {len(KICK_LOG)} kicks')
    bed, sfx = render_mix()
    wav = os.path.join(a.out_dir, 'music.wav')
    mix = finish(master(bed, sfx), os.path.join(a.out_dir, '_level_tmp.wav'))
    mp3 = os.path.join(a.out_dir, 'music.mp3')
    write_wav(wav, mix)
    m = encode(wav, mp3)
    print(f"music: {mix.shape[1] / SR:.2f}s  wav {m['input_i']} LUFS / {m['input_tp']} dBTP -> {mp3}")
    dbg = os.environ.get('MUSIC_LLM_DEBUG')
    if dbg:
        os.makedirs(dbg, exist_ok=True)
        k = int(TOTAL * SR)
        write_wav(os.path.join(dbg, 'bed.wav'), np.clip(bed[:, :k] * BED_GAIN * .5, -1, 1))      # stems as they enter the master, both at -6 dB
        write_wav(os.path.join(dbg, 'sfx.wav'), np.clip(sfx[:, :k] * SFX_GAIN * .5, -1, 1))
        write_wav(os.path.join(dbg, 'drm.wav'), np.clip(BUS['drm'][:, :k] * .9 * .5, -1, 1))
        json.dump(sorted(KICK_LOG), open(os.path.join(dbg, 'kicks.json'), 'w'))


if __name__ == '__main__':
    main()
