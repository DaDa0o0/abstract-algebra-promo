"""Score and sound design for "How a large language model works" (the 2:50 cut): A minor -> C major, 96 BPM, 68 bars of 2.5 s.

    python3 llm-intro/music_llm.py [--cues FILE] [--out-dir DIR]     -> music.wav, music.mp3 (44.1 kHz stereo, 170.0 s)

Locked to the visual bar grid: bar k starts at k * 2.5 s, one beat is 0.625 s.  Every kick sits on that grid (kick onsets are
only ever placed on beats); the chord changes and section changes sit on beats too.

Structure (global time; bars in brackets; the section table of SPEC.md section 2):
    hook      0-10      [0-3]    sparse heartbeat pulse, glassy bell / felt keys ask the "next word" motif (it hangs on the 5th) under the
                                 typing (0.5-2.7 s), a riser that peaks EXACTLY at 6.25 s where the title chord (Fmaj7) blooms: the bloom is
                                 kept at about -12 LUFS momentary (3 dB under the peak of the piece), preceded by an 80 ms gap in the whole mix
    tokens    10-25     [4-9]    curious light groove: kalimba / marimba 8ths, soft kick on 1 and 3, shaker + hats with air; Am F C G
    vectors   25-40     [10-15]  the groove develops (bell sparkle, 8th bass, wider pad); brighter from 31.25 s (16th arps, strings, clap,
                                 pad filter opens); a lift 37.5-40 s (strings, snare roll, riser) that is released at 40 s
    attention 40-60     [16-23]  three steps: A 40-48.75 restrained (felt-piano ostinato, heartbeat sub); B 48.75-53.75 strings enter,
                                 soft kick, 8th bass; C 53.75-60 the full build (4-on-the-floor, 16ths, snare rolls, riser into 60); >= 4 dB A -> C
    predict   60-80     [24-31]  the aha: lift to C major at 60 (brighter, not louder: calm and sparkly 60-68.1); suspense 68.1-71.25 (dark, sparse,
                                 low drone, clock-like heartbeat, room for the roulette ticks, a gathering tension) -> the draw lands at 71.25 (soft
                                 C major) and a calm sparse hold until 74.375, where a light drum loop starts (to 80)
    read      80-95     [32-37]  darker, urgent, driving: sub pulsing in 8ths, low string ostinato, data-tick hats; from 87.5 s a suspended
                                 questioning colour (Asus / Dm, the ostinato dissolves into held notes, the question on felt piano), then 92.5-95 E7 tension
    learn     95-115    [38-45]  restrained motor ostinato 95-101.25; steady build 101.25-108.75; PEAK 108.75-115 (4-on-the-floor, clap, bass line,
                                 16th arps, taiko, a riser through the last bar): the loudest sustained part of the piece
    teach     115-140   [46-55]  release and warmth: felt piano + pad + a gentle beat; questioning sparse 115-121.9; warmer 121.9-128.75;
                                 strings build 128.75-136.25; a warm resolved C major chord 136.25-140
    chat      140-155   [56-61]  clean light pulse (soft four-on-the-floor, pluck / kalimba 8ths); from 148.125 s slightly uneasy (Dm / Asus /
                                 Gsus, no kick, held tones, the question again, a soft riser); resolves at 155 s
    finale    155-170   [62-67]  pad swell and the motif ANSWERED over strings 155-163.5 (it lands on the tonic), a growing beat, a sparse collapse
                                 163.5-165, the title hit at 165.0 s (80 ms gap, then C major with kick, taiko, crash), the last tonic rings and fades to
                                 true silence by 169.8 s

Loudness arc of the bed alone (K-weighted momentary, median per section, dB re the learn peak, measured on the finished mp3): hook -11 (sparse; the bloom
at 6.25 s stays at about -12 LUFS, 3.5 dB under the loudest moment), tokens -6.6, vectors -5.5, attention A -8 / B -6 / C -3.4 (>= 4 dB A -> C), predict
-5.8 (calm) / -9.5 (suspense) / -7.7 (hold) / -6.3 (loop), read -4.2 (questioning -5.7), learn restrained -5.9 -> build -3.5 -> PEAK 0, teach -9.9 -> -5.3, chat
-6.8, finale -1.1 (title hit and ring -0.9).  ARC is a table of gain breakpoints, one level per ~2.5 s inside a section and a step between sections: it was fitted
(per-segment knobs, a few iterations) so that the bed alone, measured through the real master chain, follows those targets.  The master then levels the whole
piece to -14 LUFS.  The sfx follow the arc at half its depth (SFX_ARC) and are kept under the bed's own top end by a rider (ride_sfx).

The motif ("next word"): A4 C5 E5 D5 then E5 held (question: hangs on the 5th) / C5 held (answer: lands on the tonic).  It is asked in the hook, over
the tokens / vectors / attention / predict / read / learn / teach / chat sections (on different instruments and over different chords), and answered
only in the finale (bars 62 and 64, again as a fragment on the last chord).
Chords by bar: see CHORDS (Am F C G Dm E, plus Asus and Gsus for the suspended passages).  Over a G chord the question is G B D E D (a C would be
an avoid-note against the B).

Sound design: every cue name of SPEC.md section 6 has a foley-style synth (pentatonic-snapped pitches, chord-aware: A C D E G, A B D E G# over E, A B D E G
over G; consecutive cues of one name never share a pitch unless the sheet repeats it).  `whoosh`: t is the START of the sweep; rev=1 is a build that rises
slowly and ends abruptly at t + dur (so a rev whoosh into a hit starts `dur` earlier).  Dense runs of small cues (type / chip / tick / blip) obey a
constant-power rule: above DENSE_RATE cues per second the run gets no louder.
Bed stems (pad, strings, plucks, drums, bass) have their own convolution reverbs (returns high-passed at 170 Hz); the pad and strings are widened
(decorrelated above 150 Hz, mono below) and filtered by a time-varying low-pass automation (PAD_CUT / STR_CUT, one knot list per section); they are ducked
by the kick; big cues (hit, boom, stamp...) duck the whole bed a little, small UI cues duck only the 1.5-9 kHz band of the bed, and the 80 ms gaps (-12 dB,
whole mix, back at unity on the hit) precede the title bloom at 6.25 s and the title hit at 165.0 s.
Noise-based sounds (risers, crashes, reversed crash, snares, the riser cue) are tilted about -3 dB/oct above 5 kHz and low-passed at 9.5 kHz so that noise stacks do
not hiss; the kick fundamental follows the chord root (no beating against the sub); step cues have a tonal 1.8-2.4 kHz component so they stand out from
the 16th hats.  Every waveform ends in a raised-cosine fade (no cut tails).
Master: glue compressor -> true-peak look-ahead limiter (4x oversampled, ramped gain, ceiling -2 dBTP, starts at unity) levelled to -14 LUFS by measurement
(no peak-normalisation) -> curved fade from 168.6 s to true silence at 169.8 s.  music.wav is therefore already at -14 LUFS / TP -2 dBTP; music.mp3 is that wav through
an alimiter at -2.3 dB (LAME overshoots by about 1 dB: TP <= -1.2) and is the deliverable (it decodes 219 samples = 5 ms later than the wav and its
container start_time is 0.025 s: the LAME delay; mux with -ss 0, the 5 ms is below a frame).  There is deliberately NO loudnorm in the mp3 path: ffmpeg's
loudnorm reverts to its dynamic mode when the source true peak is above its TP target and then flattens the loudness arc.
Everything is deterministic (seeded RNG keyed by note / cue time, cues processed in time order); unknown cue names, bad times and bad options are skipped
with a warning.

Dev hook: MUSIC_LLM_DEBUG=<dir> additionally dumps bed.wav, sfx.wav, drm.wav (all at -6 dB, as they enter the master) and kicks.json there.
"""
import argparse
import bisect
import json
import os
import shutil
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
NBARS = 68
TOTAL = NBARS * BAR        # 170.0 s
FADE_END = 169.8           # true silence from here on
FADE_EXP = 1.6
FADE_LEN = 1.2             # curved fade-out guard: starts at 168.6 s (the last chord is full until 168.2 s and releases on its own)
BED_GAIN = 1.4             # bed -> master
SFX_GAIN = .65             # sfx bus -> master (about -2.5 dB under the old mix, so the score is never behind the effects)
TARGET_LUFS = -14.0        # the wav is levelled to this before the mp3 two-pass loudnorm (which then only trims)
CEIL_DB = -2.0             # true-peak ceiling of the wav
N = int((TOTAL + 4) * SR)
F32 = np.float32
TAU = 2 * np.pi
BUS = {k: np.zeros((2, N), F32) for k in ('mus', 'bass', 'pad', 'str', 'drm', 'sfx', 'hall', 'plate', 'room', 'sfxwet')}
KICKS = []                 # (time, depth) -> sidechain of pad / strings / bass
CUE_DUCKS = []              # (time, depth): the bed's 1.5-9 kHz band ducks briefly under the small UI cues so they stay readable
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
def v_bass(m, dur, cut=650):
    t = tv(dur + .15)
    f = midi(m)
    s = (lp(saw(f, t), cut) * .8 + np.sin(TAU * f * t)) * env_s(len(t), .004, .1, dur) * np.exp(-t / (dur * 1.3 + .2))
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


def i_bassnote(t0, m, dur, gain=.1, pan=0.0, cut=650):
    put(v_bass(m, round(dur, 3), cut), t0, 'bass', gain, pan)


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
CHORDS = {
    # hook
    0: 'Am', 1: 'Am', 2: [(0, 'Am'), (2, 'F')], 3: [(0, 'F'), (3, 'G')],
    # tokens
    4: 'Am', 5: 'F', 6: 'C', 7: 'G', 8: 'Am', 9: [(0, 'F'), (2, 'G')],
    # vectors
    10: 'F', 11: 'C', 12: [(0, 'Am'), (2, 'F')], 13: 'C', 14: [(0, 'G'), (2, 'Am')], 15: [(0, 'F'), (2, 'G')],
    # attention
    16: 'Am', 17: 'F', 18: 'C', 19: [(0, 'G'), (2, 'Am')], 20: 'F', 21: [(0, 'Dm'), (2, 'Am')], 22: 'F', 23: [(0, 'Dm'), (2, 'G')],
    # predict
    24: 'C', 25: 'G', 26: [(0, 'Am'), (2, 'F')], 27: 'Am', 28: [(0, 'Dm'), (2, 'C')], 29: [(0, 'F'), (2, 'G'), (3, 'C')], 30: 'C', 31: [(0, 'F'), (2, 'E')],
    # read
    32: 'Am', 33: 'Am', 34: [(0, 'F'), (2, 'E')], 35: 'Asus', 36: [(0, 'Dm'), (2, 'Asus')], 37: 'E',
    # learn
    38: 'Am', 39: 'F', 40: [(0, 'C'), (2, 'G')], 41: 'Am', 42: 'F', 43: [(0, 'F'), (2, 'C')], 44: [(0, 'G'), (2, 'Am')], 45: [(0, 'F'), (2, 'G')],
    # teach
    46: 'Am', 47: 'F', 48: [(0, 'Dm'), (3, 'C')], 49: 'C', 50: 'G', 51: [(0, 'Am'), (2, 'F')], 52: [(0, 'C'), (2, 'G')],
    53: [(0, 'Am'), (2, 'Dm')], 54: [(0, 'G'), (2, 'C')], 55: 'C',
    # chat
    56: 'C', 57: 'Am', 58: 'F', 59: [(0, 'G'), (1, 'Dm')], 60: [(0, 'Asus'), (2, 'Dm')], 61: [(0, 'Dm'), (2, 'Gsus')],
    # finale
    62: 'C', 63: [(0, 'Am'), (2, 'F')], 64: 'C', 65: [(0, 'F'), (2, 'G')], 66: 'C', 67: 'C'}
VOIC = {'Am': [57, 60, 64, 67], 'F': [53, 57, 60, 64], 'C': [55, 60, 64, 71], 'G': [55, 59, 62, 69],
        'Dm': [53, 57, 60, 65], 'E': [52, 56, 59, 62], 'Asus': [57, 62, 64, 69], 'Gsus': [55, 60, 62, 67]}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31, 'Dm': 38, 'E': 40, 'Asus': 33, 'Gsus': 31}
PCS = {'Am': (9, 0, 4, 11), 'F': (5, 9, 0, 7), 'C': (0, 4, 7, 2), 'G': (7, 11, 2, 9), 'Dm': (2, 5, 9, 0), 'E': (4, 8, 11, 2),
       'Asus': (9, 2, 4, 7), 'Gsus': (7, 0, 2, 9)}


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
    segs_ = []
    for b in range(b0, b1):
        c = CHORDS[b]
        lst = [(0, c)] if isinstance(c, str) else c
        for i, (bt, name) in enumerate(lst):
            t0 = tb(b, bt)
            t1 = tb(b, lst[i + 1][0]) if i + 1 < len(lst) else tb(b + 1)
            if segs_ and segs_[-1][2] == name and abs(segs_[-1][1] - t0) < 1e-6:
                segs_[-1] = (segs_[-1][0], t1, name)
            else:
                segs_.append((t0, t1, name))
    return segs_


def segs(ta, tz):
    """chord segments clipped to the time window [ta, tz)."""
    out = []
    for t0, t1, name in segments(int(ta // BAR + 1e-9), min(NBARS, int(np.ceil(tz / BAR - 1e-9)))):
        a, z = max(t0, ta), min(t1, tz)
        if z - a > 1e-6:
            out.append((a, z, name))
    return out


def pool(name, lo, hi):
    return [m for m in range(lo, hi + 1) if m % 12 in PCS[name]]


def grid(win, step):
    """(time, global step index) of every grid point of `step` inside the window."""
    i0 = int(np.ceil(win[0] / step - 1e-6))
    i1 = int(np.ceil(win[1] / step - 1e-6))
    for i in range(i0, i1):
        yield i * step, i


def ramp(t, a, b, ga, gb):
    return ga + (gb - ga) * min(1.0, max(0.0, (t - a) / (b - a)))


def W(b0, b1=None, beat0=0.0, beat1=0.0):
    """time window from bar b0 (+beat0 beats) to bar b1 (+beat1 beats); b1 None -> one bar."""
    return (tb(b0, beat0), tb(b0 + 1 if b1 is None else b1, beat1))


def pads_w(win, gain=.03, att=.8, rel=.8, lift=0, hall=0.0, voic=None, gf=None):
    for a, z, name in segs(*win):
        v = voic(name) if voic else VOIC[name]
        pad(a, [m + lift for m in v], z - a, gain * (gf(a) if gf else 1), att, rel, hall=hall)


def open_voic(name):
    """pad voicing for the dense sections: the two lowest notes go up an octave (nothing between 110 and 260 Hz but the bass)."""
    v = VOIC[name]
    return [v[0] + 12, v[1] + 12, v[2], v[3]]


def str_notes(name, low=False, open_=False):
    v = VOIC[name]
    notes = [v[1] - 12, v[2], v[3]] if low else [v[0], v[1], v[2] + 12, v[3] + 12]      # low: no root (the sub and the bass own it)
    if open_:
        notes = [v[1], v[2], v[3], v[1] + 12, v[2] + 12] if low else [v[0] + 12, v[1] + 12, v[2] + 12, v[3] + 12]   # open: nothing below 260 Hz
    return notes


def strs_w(win, gain=.025, att=.9, rel=.8, low=False, open_=False, gf=None):
    for a, z, name in segs(*win):
        strpad(a, str_notes(name, low, open_), z - a, gain * (gf(a) if gf else 1), att, rel)


MOT_Q = [(0, 69, .5), (.5, 72, .5), (1, 76, 1), (2, 74, 1), (3, 76, 2.2)]    # question: hangs on the 5th
MOT_QG = [(0, 67, .5), (.5, 71, .5), (1, 74, 1), (2, 76, 1), (3, 74, 2.2)]    # question over G chords: G B D E D (E = 6th, no C against the B)
MOT_R = [(0, 69, .5), (.5, 72, .5), (1, 76, 1), (2, 74, 1), (3, 72, 4.0)]    # answer: lands on the tonic


def motif(t0, notes, inst, tr=0, gain=.05, vel=.8, pan=0.0, **kw):
    for bt, m, ln in notes:
        inst(t0 + bt * BEAT, m + tr, ln * BEAT, gain=gain, pan=pan, vel=vel * (1.0 if bt else 1.05), **kw)


def arp_bar(bar, step, patt, inst, lo, hi, gain, vel_pat=(1, .6, .8, .6), pan_w=.5, t_from=0.0, t_to=1e9, tr=0, gf=None):
    """arpeggiate the chord of this bar; patt indexes into the chord's pool, None = rest; [t_from, t_to) clips the bar."""
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
        inst(t, m, step * .9, gain=gain * vel_pat[k % len(vel_pat)] * (gf(t) if gf else 1), pan=np.sin(k * 1.7 + bar) * pan_w, vel=.9)


def arpw(win, step, patts, inst, lo, hi, gain, **kw):
    for b in range(int(win[0] // BAR + 1e-9), int(np.ceil(win[1] / BAR - 1e-9))):
        arp_bar(b, step, patts[b % len(patts)], inst, lo, hi, gain, t_from=win[0], t_to=win[1], **kw)


P8A = [0, 2, 4, 2, 3, 2, 1, 2]
P8B = [0, 3, 2, 4, 1, 3, 2, None]
P8C = [0, 2, 1, 3, None, 4, 3, 1]
P8G = [None, 1, None, 3, None, 2, None, 4]                         # glass top line on the off-beats
P16A = [0, 2, 4, 2, 3, 5, 4, 2, 1, 3, 5, 3, 2, 4, 3, 1]
P16B = [0, 3, 1, 4, 2, 5, 3, 6, 4, 2, 5, 3, 1, 4, 2, 0]
OST16 = [0, 2, 3, 2, 0, 2, 3, 2, 0, 2, 3, 2, 1, 2, 3, 2]           # motor-like ostinato (learn)
SPARK16 = [None, 3, None, None, 5, None, 2, None, None, 4, None, 6, None, None, 3, None]


# ---- rhythm helpers working on time windows
def kicks_w(win, beats=(0, 2), g=.2, duck=.35, gf=None):
    for t, i in grid(win, BEAT):
        if i % 4 in beats:
            kick(t, g * (gf(t) if gf else 1), duck)


def shaker_w(win, g=.03, pan=.25, gf=None):
    for t, i in grid(win, EIGHTH):
        shaker(t, g * (1.15 if i % 2 else 1.3) * (gf(t) if gf else 1), pan=-pan + 2 * pan * (i % 2))


def hat8_w(win, g=.03, kind=0, gf=None):
    for t, i in grid(win, EIGHTH):
        if i % 2:
            hat(t, g * (gf(t) if gf else 1), kind)


def hat16_w(win, ga=.03, gb=.015, gf=None):
    for t, i in grid(win, SIXTEENTH):
        hat(t, (ga if i % 4 == 2 else gb) * (gf(t) if gf else 1), 0, pan=.3 * np.sin(i))


def clap_w(win, beats=(1, 3), g=.1, gf=None):
    for t, i in grid(win, BEAT):
        if i % 4 in beats:
            clap(t, g * (gf(t) if gf else 1))


def snare_w(win, beats=(1, 3), g=.1, gf=None):
    for t, i in grid(win, BEAT):
        if i % 4 in beats:
            snare(t, g * (gf(t) if gf else 1))


def rim_w(win, beats=(1, 3), g=.03, gf=None):
    for t, i in grid(win, BEAT):
        if i % 4 in beats:
            rim(t, g * (gf(t) if gf else 1))


def data_hats(win, seed, p=.72, g=.02, gf=None):
    """sparse 16th data-tick hats (kind 2), a different random pattern per seed."""
    for t, i in grid(win, SIXTEENTH):
        rg = R(21, seed, i)
        if rg.random() < p:
            hat(t, (g if i % 4 == 0 else g * .55) * (.6 + .6 * rg.random()) * (gf(t) if gf else 1), 2, pan=rg.random() - .5)


# ---- bass helpers
def sub_w(win, gain=.15, rel=.2, up=0, shorten=.05, att=.01):
    for a, z, name in segs(*win):
        i_subnote(a, ROOT[name] + up, z - a - shorten, gain, att=att, rel=rel)


def sub8_w(win, gain=.12, acc=.75):
    for t, i in grid(win, EIGHTH):
        i_subnote(t, ROOT[chord_at(t)], EIGHTH * .95, gain * (1 if i % 2 == 0 else acc), att=.006, rel=.05)


def bass8_w(win, gain=.1, cut=650, patt=(0, 0, 12, 0, 0, 12, 7, 12), base=12, off=.78, gf=None):
    for t, i in grid(win, EIGHTH):
        r = ROOT[chord_at(t)]
        i_bassnote(t, r + base + patt[i % 8], EIGHTH * .85, gain * (1 if i % 2 == 0 else off) * (gf(t) if gf else 1), cut=cut)


def groove_bass(win, sg=.2, bg=.06):
    """tokens-style bass: the sub on the bar line, the saw octave on the 'and' of 3 and 4."""
    for t, i in grid(win, BEAT / 2):
        k = i % 8
        r = ROOT[chord_at(t)]
        if k == 0:
            i_subnote(t, r, 1.5 * BEAT, sg)
        elif k == 5:
            i_bassnote(t, r + 12, EIGHTH, bg)
        elif k == 7:
            i_bassnote(t, r + (7 if (i // 8) % 2 else 12), EIGHTH, bg * .85)


def cello8_w(win, gain=.076, up=24, osc=(0, 0, 7, 0, 0, 7, 10, 7)):
    for t, i in grid(win, EIGHTH):
        r = ROOT[chord_at(t)] + up
        put(v_cello(r + osc[i % 8], round(EIGHTH * .8, 3)), t, 'mus', gain * (1 if i % 2 == 0 else .72), pan=-.15 if i % 2 else .15, hall=.2)


def bell_dots(win, step, seed, g=.022, lo=79, hi=100, p=1.0, dec=1.6):
    """sparse pentatonic bell sparkle (A minor pentatonic over everything, A B D E G# over E)."""
    for t, i in grid(win, step):
        rg = R(61, seed, i)
        if rg.random() > p:
            continue
        ms = [m for m in range(lo, hi + 1) if m % 12 in pent_of(chord_at(t))]
        i_bell(t, ms[int(rg.integers(len(ms)))], gain=g * (.7 + .6 * rg.random()), pan=rg.random() - .5, dec=dec)


def lift_into(t, dur=2.5, riser_g=.06, crash_g=.05, f0=220, roll=None):
    """riser + reversed crash that both peak at t (+ optional snare roll (t0, g0, g1))."""
    riser(t, dur, riser_g, f0=f0)
    crash_rev(t, min(1.6, dur), crash_g)
    if roll:
        snare_roll(t - roll[0], t, roll[1], roll[2])


# ================================================================== the score
def s_hook():
    """bars 0-3 (0-10 s): sparse pulse, glassy question motif under the typing, riser to the bloom at 6.25 s (F maj7)."""
    for t, g in ((tb(0, 2), .26), (tb(1, 0), .28), (tb(1, 2), .3), (tb(2, 0), .3)):                    # heartbeat pulse
        i_subnote(t, 33, .35, g, att=.008, rel=.2)
        i_subnote(t + .26, 33, .3, g * .66, att=.008, rel=.2)
    pad(0.0, [57, 64, 67, 72], 6.25, gain=.026, att=3.2, rel=.05, spread=.8, hall=.6)             # glass swell under the typing
    strpad(0.6, [45, 57, 64], 5.6, gain=.014, att=3.2, rel=.05)
    motif(tb(0, 1), MOT_Q, i_bell, tr=0, gain=.035, vel=.6, dec=1.3)                             # the question, in glass, on the beat grid: it hangs on the 5th
    motif(tb(0, 1), MOT_Q, i_felt, tr=0, gain=.045, vel=.45)
    for k, m in enumerate([88, 91, 93, 96]):                                                       # soft data sparkle after the typing, running up into the riser
        i_kalimba(tb(1, 2) + k * EIGHTH, m, gain=.014 + .002 * k, pan=(k - 1.5) * .3, vel=.6, dec=.5)
    bell_dots((tb(1, 3), tb(2, 2)), BEAT, 3, g=.012, lo=84, hi=96, dec=1.0)
    riser(tb(2, 2), 2.5, .055, f0=180, pw=3.2)                                                    # steep: the last 100 ms must sit under the bloom
    DIPS.append((tb(2, 2), .08))                                                                  # 80 ms gap in the WHOLE mix, released exactly at the hit
    # title bloom, F major 7 at 6.25 s (bar 2 beat 2)
    t = tb(2, 2)
    kick(t, .42, duck=.2)                                                                         # the title chord must not start under a duck
    i_subnote(t, 29, 2.4, .20, rel=.6)
    pad(t, VOIC['F'], 3.2, gain=.055, att=.05, rel=1.2)
    strpad(t, [41, 57, 64, 72, 76], 2.8, gain=.034, att=.25, rel=1.2)
    for k, m in enumerate([65, 69, 72, 76, 81, 84, 88]):
        i_bell(t + .04 + k * .085, m, gain=.045, pan=(k - 3) * .25, dec=2.2)
    crash(t, .04, 2.2)
    # bar 3: the title holds; warm, near-still, felt piano and glass; a pickup into the groove
    for k, m in enumerate([60, 65, 69, 72, 76]):
        i_felt(tb(3, 0) + .05 + k * .31, m, gain=.036, pan=(k - 2) * .15, vel=.45)
    i_bell(tb(3, 2), 84, gain=.02, pan=.3, dec=1.8)
    i_bell(tb(3, 3), 91, gain=.016, pan=-.3, dec=1.8)
    i_subnote(tb(3, 0), 29, 2.0, .12, att=.4, rel=.4)
    shaker_w((tb(3, 2), tb(4)), .012)
    crash_rev(tb(4), 1.0, .03)


def groove_bar(b, g=1.0, top=True, win=None):
    """curious groove bar (tokens / early vectors): warm pad, soft kick on 1 and 3, marimba 8ths, hats / shaker with air."""
    w = win or W(b)
    groove_bass(w, .2 * g ** .5, .06 * g ** .5)
    kicks_w(w, (0, 2), .2 * g ** .5, .35)
    shaker_w(w, .04, .25)
    hat8_w(w, .036)
    arpw(w, EIGHTH, [P8A, P8B], i_marimba, 60, 81, .036 * g)
    if top:
        arpw(w, EIGHTH, [P8G], i_kalimba, 72, 93, .027 * g)


def s_tokens():
    """bars 4-9 (10-25 s): curious light groove, plucks / marimba 8ths, soft kick on 1 and 3, shaker / hats with air."""
    pads_w(W(4, 10), gain=.022, att=1.0, rel=1.0, gf=lambda t: 1.6 if int(t // BAR) in (6, 7) else 1.0)   # the C and G bars have the low pad voicings: +4 dB
    lv = {4: .8, 5: 1.0, 6: 1.5, 7: 1.4, 8: 1.1, 9: 1.2}
    for b in range(4, 10):
        groove_bar(b, lv[b], top=(b > 4))
    i_bell(tb(5, 3), 88, gain=.024, pan=.4, dec=1.6)
    motif(tb(5), MOT_Q, i_kalimba, gain=.052, vel=.85, pan=.15, dec=.9)                          # the question, first asked on kalimba (over F)
    motif(tb(7), MOT_QG, i_marimba, tr=12, gain=.05, vel=.85, pan=-.2, dec=.4)                    # and over G, an octave up
    i_bell(tb(7, 3), 91, gain=.022, pan=-.4, dec=1.6)
    motif(tb(8), MOT_Q, i_bell, tr=12, gain=.022, vel=.7, dec=1.4)
    hat16_w(W(9, 10, 2, 0), .02, .012)                                                            # 16ths pick up into the vectors
    snare_w(W(9, 10, 3, 0), (3,), .05)


def s_vectors():
    """bars 10-15 (25-40 s): the groove develops (bell sparkle, wider pad, 8th bass); brighter from 31.25 s (16ths, strings,
    clap); a lift 37-40 s (strings swell, snare roll, riser) that is released at 40 s."""
    a, bz = tb(10), tb(12, 2)
    pads_w((a, tb(16)), gain=.026, att=1.2, rel=1.0, gf=lambda t: 1.5 if int(t // BAR) in (11, 13) else 1.0)
    # 25-31.25 developing
    w1 = (a, bz)
    bass8_w(w1, .06, 550, patt=(0, 0, 12, 0, 0, 7, 12, 7), base=12, off=.7)
    sub_w(w1, .17, rel=.2)
    kicks_w(w1, (0, 2), .24, .38)
    kicks_w(w1, (1, 3), .07, .15)
    shaker_w(w1, .04, .3)
    hat8_w(w1, .036)
    arpw(w1, EIGHTH, [P8B, P8C, P8A], i_marimba, 60, 84, .04)
    arpw(w1, EIGHTH, [P8G], i_kalimba, 72, 96, .028)
    bell_dots(w1, BEAT * 2, 11, g=.022, lo=84, hi=98)
    motif(tb(11), MOT_Q, i_kalimba, gain=.05, vel=.85, pan=.15, dec=.9)
    motif(tb(11), MOT_Q, i_bell, tr=12, gain=.018, vel=.7, dec=1.4)
    strs_w((tb(11, 2), bz), gain=.02, att=1.4, rel=.8)
    # 31.25-37.5 brighter
    w2 = (bz, tb(15))
    bass8_w(w2, .075, 650, patt=(0, 0, 12, 0, 0, 12, 7, 12), base=12)
    sub_w(w2, .16, rel=.2)
    kicks_w(w2, (0, 2), .3, .4)
    kicks_w(w2, (1, 3), .09, .2)
    hat16_w(w2, .03, .015)
    shaker_w(w2, .03, .3)
    clap_w(w2, (1, 3), .05)
    arpw(w2, SIXTEENTH, [P16A, P16B], i_marimba, 60, 91, .04, vel_pat=(1, .55, .8, .55))
    arpw(w2, EIGHTH, [P8G], i_pluck, 67, 93, .03)
    arpw(w2, EIGHTH, [[None, 1, None, 3, None, 2, None, 4]], i_kalimba, 76, 100, .026)
    bell_dots(w2, BEAT, 12, g=.024, lo=88, hi=100, p=.8)
    strs_w(w2, gain=.034, att=1.3, rel=.9, gf=lambda t: ramp(t, bz, tb(15), 1.0, 1.4))
    motif(tb(13), MOT_QG, i_bell, tr=12, gain=.02, vel=.8, dec=1.4)
    motif(tb(14, 2), MOT_Q, i_strlead, tr=0, gain=.034, vel=.8)
    # 37.5-40 lift
    w3 = (tb(15), tb(16))
    bass8_w(w3, .09, 650, gf=lambda t: ramp(t, w3[0], w3[1], 1.0, 1.3))
    sub_w(w3, .18, rel=.2)
    kicks_w(w3, (0, 1, 2, 3), .28, .4)
    snare_roll(tb(15, 1), tb(16), .03, .19)
    riser(tb(16), 2.5, .066, f0=200)
    crash_rev(tb(16), 1.5, .05)
    pad(tb(15), [60, 64, 67, 72], BAR - .05, gain=.03, att=1.6, rel=.2)                         # an added bright triad: the lift


def s_attention():
    """bars 16-23 (40-60 s): three steps.  A (40-48.75) restrained: felt-piano ostinato, heartbeat sub, no drums to speak of;
    B (48.75-53.75) strings enter, soft kick, 8th bass, marimba; C (53.75-60) full build: 4-on-the-floor, 16ths, snare roll, riser."""
    wa, wb, wc = (tb(16), tb(19, 2)), (tb(19, 2), tb(21, 2)), (tb(21, 2), tb(24))
    gpad = lambda t: ramp(t, tb(16), tb(21, 2), 1.0, 1.7) * (1.5 if int(t // BAR) in (18,) else 1)
    pads_w((tb(16), tb(19, 2)), gain=.02, att=1.3, rel=1.0, gf=gpad)
    pads_w((tb(19, 2), tb(24)), gain=.02, att=1.3, rel=1.0, gf=gpad, voic=open_voic)                # from B on the pad leaves 110-330 Hz to the bass
    # --- A
    sub_w(wa, .12, rel=.3)
    kicks_w(wa, (0,), .15, .3)
    kicks_w(wa, (2,), .11, .25)
    shaker_w(wa, .016, .2)
    rg = R(31, 1)
    for t, i in grid(wa, EIGHTH):
        c = chord_at(t)
        pl = pool(c, 60, 79)
        patt = [0, 2, 1, 3, 2, 4, 3, 2] if (int(t // BAR) % 2 == 0) else [0, 3, 2, 4, 1, 3, 2, 5]
        i_felt(t + rg.normal(0, .004), pl[patt[i % 8] % len(pl)], gain=.04, pan=np.sin(i + 2) * .3, vel=.4 + .22 * (i % 2 == 0) + .05 * rg.random())
    for t, i in grid(wa, BAR):
        r = ROOT[chord_at(t)]
        i_felt(t, r + 12, gain=.05, vel=.62)
        i_felt(t + 2 * BEAT, r + 19, gain=.038, vel=.5)
    motif(tb(17) + .004, MOT_Q, i_felt, gain=.058, vel=.78)                                       # the question, on piano, over F
    motif(tb(18, 0) + .004, MOT_Q, i_bell, tr=12, gain=.02, vel=.7, dec=1.4)
    bell_dots(wa, BEAT * 4, 16, g=.02, lo=84, hi=96)
    # --- B
    strs_w((tb(19, 2), tb(24)), gain=.03, att=1.4, rel=.9, low=True, open_=True, gf=lambda t: ramp(t, tb(19, 2), tb(21, 2), .9, 1.5))
    sub_w(wb, .15, rel=.2)
    bass8_w(wb, .065, 600, patt=(0, 0, 12, 0, 0, 12, 7, 12), base=12)
    kicks_w(wb, (0, 2), .22, .38)
    shaker_w(wb, .026, .25)
    hat8_w(wb, .026)
    arpw(wb, EIGHTH, [P8A, P8B], i_marimba, 60, 84, .038)
    arpw(wb, EIGHTH, [P8G], i_kalimba, 72, 96, .024)
    rg = R(31, 2)
    for t, i in grid(wb, EIGHTH):
        c = chord_at(t)
        pl = pool(c, 60, 79)
        i_felt(t + rg.normal(0, .004), pl[[0, 2, 1, 3, 2, 4, 3, 2][i % 8] % len(pl)], gain=.03, pan=np.sin(i + 2) * .3, vel=.4 + .15 * (i % 2 == 0))
    for k, t in enumerate([wb[0]] + [t_ for t_, _ in grid(wb, BAR)]):
        pl = pool(chord_at(t), 64, 79)
        i_strlead(t, pl[(k + 1) % len(pl)], (BAR * .9 if k else BAR * .5), gain=.034, vel=.8)   # a slow rising countermelody on the strings
    # --- C
    strs_w(wc, gain=.03, att=.6, rel=.8, open_=True, gf=lambda t: ramp(t, wc[0], wc[1], 1.0, 1.7))
    sub_w(wc, .16, rel=.2)
    bass8_w(wc, .09, 600, gf=lambda t: ramp(t, wc[0], wc[1], 1.0, 1.4))
    kicks_w((tb(21, 2), tb(22)), (2, 3), .26, .45)
    kicks_w((tb(22), tb(24)), (0, 1, 2, 3), .4, .55, gf=lambda t: ramp(t, tb(22), tb(24), 1.0, 1.35))
    clap_w((tb(22), tb(24)), (1, 3), .07, gf=lambda t: ramp(t, tb(22), tb(24), 1.0, 1.8))
    hat16_w((tb(22), tb(24)), .026, .012)
    hat8_w((tb(21, 2), tb(22)), .026)
    shaker_w(wc, .022, .3)
    arpw(wc, EIGHTH, [P8B, P8C], i_marimba, 60, 88, .04)
    arpw((tb(22), tb(24)), SIXTEENTH, [P16A, P16B], i_marimba, 60, 91, .04, vel_pat=(1, .55, .8, .55))
    arpw(wc, EIGHTH, [P8G], i_pluck, 67, 93, .03)
    arpw(wc, EIGHTH, [[None, 1, None, 2, None, 3, None, 4]], i_kalimba, 76, 100, .026)
    motif(tb(22), MOT_Q, i_strlead, gain=.036, vel=.85)
    motif(tb(22), MOT_Q, i_bell, tr=12, gain=.02, vel=.8, dec=1.4)
    snare_roll(tb(22, 2), tb(23), .02, .1)
    snare_roll(tb(23, 1), tb(24), .03, .2)
    riser(tb(24), 3.1, .075, f0=200)
    crash_rev(tb(24), 1.5, .056)
    taiko(tb(23, 2), .1, .2)


def s_predict():
    """bars 24-31 (60-80 s): the aha.  Lift to C major at 60 (brighter, not louder); calm and sparkly to 68.125; suspense (sparse, dark,
    low drone, heartbeat, a gathering tension) to 71.25, where the draw lands (soft C major) and a calm sparse hold follows; a light drum loop from 74.375 to 80."""
    t = tb(24)
    kick(t, .38, .7)
    i_subnote(t, 36, 1.8, .26, rel=.4)
    crash(t, .05, 2.4)
    for k, m in enumerate([72, 76, 79, 83, 88]):
        i_bell(t + k * .06, m, gain=.024, pan=(k - 2) * .25, dec=2.0)
    i_felt(t, 60, gain=.05, vel=.6)
    for m in (64, 67, 71):
        i_felt(t, m, gain=.03, vel=.55)
    # calm and sparkly 60-68.125
    wc = (tb(24), tb(27, 1))
    pads_w(wc, gain=.032, att=.06, rel=1.0, gf=lambda t: 1.0 if t < tb(25) else .8)
    strs_w(wc, gain=.026, att=.5, rel=.9, gf=lambda t: ramp(t, tb(24), tb(24, 2), 1.3, 1.0))
    sub_w(wc, .14, rel=.2, shorten=.1)
    for t, i in grid(wc, BEAT):
        if i % 4 == 2:
            i_bassnote(t + EIGHTH, ROOT[chord_at(t)] + 12, EIGHTH, .06)
    kicks_w((tb(24, 2), wc[1]), (0, 2), .17, .3)
    shaker_w((tb(24, 2), wc[1]), .022, .3)
    hat8_w((tb(25), wc[1]), .014)
    arpw(wc, EIGHTH, [[0, 2, 4, 2, 3, 1, 4, 2], [0, 3, 2, 4, 1, 3, 5, 2]], i_marimba, 67, 91, .04)
    arpw(wc, SIXTEENTH, [SPARK16], i_kalimba, 76, 100, .026, pan_w=.8)
    bell_dots(wc, BEAT * 2, 24, g=.022, lo=84, hi=100, dec=1.8)
    motif(tb(25), MOT_QG, i_bell, tr=12, gain=.017, vel=.7, dec=1.3)
    motif(tb(25), MOT_QG, i_kalimba, tr=0, gain=.034, vel=.8, pan=.2, dec=.9)
    motif(tb(26, 2), MOT_Q, i_felt, tr=0, gain=.04, vel=.55)
    # suspense 68.125-71.25: dark, sparse, a low drone, a clock-like heartbeat, a tension that gathers for the landing
    ws = (tb(27, 1), tb(28, 2))
    pads_w(ws, gain=.017, att=1.4, rel=1.0, voic=open_voic)
    strpad(ws[0], [45, 52, 57], 2.4, gain=.022, att=1.4, rel=.8)
    strpad(tb(28), [38, 45, 53, 57], 1.25, gain=.024, att=1.2, rel=.8)
    for t, i in grid(ws, BEAT * 2):
        i_subnote(t, ROOT[chord_at(t)], .4, .16, att=.008, rel=.2)
        i_subnote(t + .26, ROOT[chord_at(t)], .3, .1, att=.008, rel=.2)
    bell_dots((tb(27, 2), ws[1]), BEAT, 27, g=.012, lo=79, hi=96, p=.55, dec=1.4)
    for k, m in enumerate([76, 74, 72, 71]):                                                       # a falling question in glass over the drone
        i_kalimba(tb(27, 2) + k * BEAT, m, gain=.018, pan=(k - 1.5) * .3, vel=.6, dec=.8)
    snare_roll(tb(28, 0), ws[1], .012, .06, step=EIGHTH)
    riser(ws[1], 2.0, .04, f0=200, pw=2.6)
    # landing 71.25 (the draw): C major, soft; then a calm, sparse hold (the drawn word, the other possible draws) until the loop at 74.375
    t = tb(28, 2)
    kick(t, .26, .5)
    i_subnote(t, 36, 1.6, .16, att=.02, rel=.4)
    crash(t, .03, 2.0)
    for k, m in enumerate([79, 84, 88, 91]):
        i_bell(t + k * .07, m, gain=.024, pan=(k - 1.5) * .3, dec=2.0)
    wh = (tb(28, 2), tb(29, 3))
    pads_w(wh, gain=.026, att=.25, rel=1.0, gf=lambda t: ramp(t, wh[0], wh[1], 1.0, 1.15))
    strs_w(wh, gain=.02, att=.9, rel=.8)
    sub_w(wh, .12, rel=.2, shorten=.1)
    for t_, i in grid(wh, BEAT):
        pl = pool(chord_at(t_), 60, 79)
        i_felt(t_, pl[[0, 2, 1, 3][i % 4] % len(pl)], gain=.034, vel=.4 + .06 * (i % 2 == 0), pan=np.sin(i) * .3)
    bell_dots(wh, BEAT, 28, g=.018, lo=84, hi=100, p=.6, dec=1.8)
    shaker_w((tb(29, 2), wh[1]), .012, .2)
    crash_rev(tb(29, 3), .9, .03)
    # 74.375: light drum loop
    t = tb(29, 3)
    kick(t, .3, .6)
    crash(t, .035, 2.0)
    for k, m in enumerate([79, 84, 88, 91]):
        i_bell(t + k * .07, m, gain=.022, pan=(k - 1.5) * .3, dec=2.0)
    wl = (tb(29, 3), tb(32))
    pads_w(wl, gain=.03, att=.15, rel=1.0, gf=lambda t: ramp(t, wl[0], wl[1], 1.0, 1.0))
    strs_w(wl, gain=.022, att=.6, rel=.8)
    sub_w(wl, .14, rel=.2, shorten=.1)
    for t, i in grid(wl, BEAT):
        if i % 4 == 2:
            i_bassnote(t + EIGHTH, ROOT[chord_at(t)] + 12, EIGHTH, .06)
        if i % 4 == 3:
            i_bassnote(t + EIGHTH, ROOT[chord_at(t)] + 7, EIGHTH, .045)
    kicks_w((tb(30), wl[1]), (0, 2), .22, .35)
    clap_w(wl, (1, 3), .045)
    rim_w(wl, (1, 3), .035)
    shaker_w(wl, .022, .3)
    hat8_w(wl, .02)
    arpw(wl, EIGHTH, [[0, 2, 4, 2, 3, 1, 4, 2], [0, 3, 2, 4, 1, 3, 5, 2]], i_marimba, 62, 91, .042)
    arpw(wl, EIGHTH, [P8G], i_pluck, 62, 91, .03)
    bell_dots(wl, BEAT * 2, 30, g=.02, lo=84, hi=100)
    motif(tb(30), MOT_Q, i_kalimba, gain=.045, vel=.8, pan=.2, dec=.9)
    snare_roll(tb(31, 3), tb(32), .03, .12)
    riser(tb(32), 1.25, .05, f0=250)


def s_read():
    """bars 32-37 (80-95 s): darker, urgent, driving: sub pulsing in 8ths, low string ostinato, data-tick hats (80-87.5); from 87.5 a suspended
    questioning colour (Asus / Dm / Asus, ostinato dissolves into held notes and the question on felt piano); 92.5-95 E7 tension to the next section."""
    w1, w2, w3 = (tb(32), tb(35)), (tb(35), tb(37)), (tb(37), tb(38))
    pads_w((tb(32), tb(38)), gain=.024, att=.9, rel=.9, voic=open_voic)
    strs_w((tb(32), tb(38)), gain=.032, att=.6, rel=.8, low=True, open_=True, gf=lambda t: 1.0 if t < tb(35) else .6)
    # --- dark and driving
    sub8_w(w1, .125, .68)
    bass8_w(w1, .12, 450, patt=(0, 0, 12, 0, 0, 12, 12, 12), base=24, off=.7)                       # an octave over the sub: no doubling
    cello8_w(w1, .076, up=24)
    data_hats(w1, 32)
    kicks_w(w1, (0, 2), .4, .5)
    kicks_w((tb(34, 1), w1[1]), (1, 3), .22, .35)
    rim_w(w1, (1, 3), .03)
    for k, m in enumerate([81, 79, 76, 74]):                                                       # cold glass dots keep the sparse top
        i_kalimba(tb(33, 2 + k * .5), m, gain=.015, pan=(k - 1.5) * .3, vel=.6, dec=.7)
    i_felt(tb(33), 69, gain=.05, vel=.6)
    i_felt(tb(33, 1.5), 65, gain=.04, vel=.55)
    # --- suspended colour
    sub8_w(w2, .1, .35)
    for t, i in grid(w2, BAR):
        pl = pool(chord_at(t), 57, 69)
        i_strlead(t, pl[1 % len(pl)] + 12, BAR - .2, gain=.034, vel=.7)
        i_strlead(t + 2 * BEAT, pl[2 % len(pl)] + 12, BAR - 1.4, gain=.028, vel=.6)
    cello8_w((tb(35), tb(35, 2)), .05, up=24, osc=(0, 0, 0, 0, 0, 7, 0, 0))
    kicks_w(w2, (0,), .26, .4)
    data_hats(w2, 35, p=.35, g=.016)
    motif(tb(35, 0) + .004, MOT_Q, i_felt, gain=.056, vel=.7)                                       # the question again, unanswered
    motif(tb(35, 0), MOT_Q, i_bell, tr=12, gain=.014, vel=.6, dec=1.4)
    motif(tb(36, 2), [(0, 74, .5), (.5, 77, .5), (1, 81, 1), (2, 79, 2.5)], i_felt, gain=.05, vel=.65)
    for k, m in enumerate([88, 86, 84, 81]):
        i_kalimba(tb(36, 1 + k * .5), m, gain=.014, pan=(k - 1.5) * .3, vel=.55, dec=.7)
    # --- tension
    sub8_w(w3, .15, .8)
    bass8_w(w3, .12, 450, patt=(0, 0, 12, 0, 0, 12, 12, 12), base=24, off=.7)
    cello8_w(w3, .07, up=24)
    kicks_w(w3, (0, 1, 2, 3), .34, .5)
    data_hats(w3, 37, p=.8, g=.022)
    snare_roll(tb(37, 2), tb(38), .02, .16)
    riser(tb(38), 2.5, .07, f0=250)
    crash_rev(tb(38), 1.4, .05)


def s_learn():
    """bars 38-45 (95-115 s): restrained ostinato (95-101.25: motor marimba 16ths, low strings, soft pulse) -> steady build (101.25-108.75)
    -> PEAK (108.75-115: four-on-the-floor, snare / clap, bass line, 16th arps, taiko, riser through the last bar)."""
    wr, wb, wp = (tb(38), tb(40, 2)), (tb(40, 2), tb(43, 2)), (tb(43, 2), tb(46))
    pads_w((tb(38), tb(43, 2)), gain=.026, att=.8, rel=.8, voic=open_voic, gf=lambda t: ramp(t, tb(38), tb(43, 2), .9, 1.7))
    # --- restrained
    sub8_w(wr, .1, .5)
    arpw(wr, SIXTEENTH, [OST16], i_marimba, 60, 79, .03, vel_pat=(1, .5, .75, .5), pan_w=.3)
    cello8_w(wr, .03, up=24, osc=(0, 0, 7, 0, 0, 7, 10, 7))
    kicks_w(wr, (0, 1, 2, 3), .16, .3)
    hat8_w(wr, .022)
    strs_w(wr, gain=.022, att=1.2, rel=.8, low=True, open_=True)
    motif(tb(39) + .004, MOT_Q, i_bell, tr=12, gain=.02, vel=.7, dec=1.4)
    # --- steady build
    sub8_w(wb, .12, .7)
    bass8_w(wb, .1, 500, gf=lambda t: ramp(t, wb[0], wb[1], .8, 1.4))
    cello8_w(wb, .035, up=24)
    arpw(wb, SIXTEENTH, [OST16], i_marimba, 60, 84, .034, vel_pat=(1, .5, .75, .5), pan_w=.3)
    arpw(wb, EIGHTH, [P8G], i_pluck, 67, 93, .028)
    kicks_w(wb, (0, 1, 2, 3), .3, .45, gf=lambda t: ramp(t, wb[0], wb[1], 1.0, 1.35))
    hat16_w((tb(41, 2), wb[1]), .024, .012)
    hat8_w((wb[0], tb(41, 2)), .026)
    clap_w((tb(42), wb[1]), (1, 3), .08, gf=lambda t: ramp(t, tb(42), wb[1], 1.0, 1.7))
    strs_w(wb, gain=.032, att=1.0, rel=.8, open_=True, gf=lambda t: ramp(t, wb[0], wb[1], .8, 1.5))
    snare_roll(tb(43), tb(43, 2), .03, .12)
    snare(tb(43, 1.5), .05)
    riser(tb(43, 2), 1.5, .05, f0=300)
    crash_rev(tb(43, 2), 1.0, .05)
    motif(tb(41), MOT_Q, i_marimba, tr=0, gain=.04, vel=.8, dec=.5)
    # --- PEAK
    t = wp[0]
    kick(t, .6, .75)
    i_subnote(t, 36, 1.5, .24, rel=.3)
    crash(t, .08, 2.4)
    taiko(t, .24, -.2)
    pads_w(wp, gain=.058, att=.15, rel=.8, voic=open_voic)
    strs_w(wp, gain=.05, att=.2, rel=.8, open_=True)
    kicks_w((wp[0] + BEAT, wp[1]), (0, 1, 2, 3), .58, .55)
    clap_w(wp, (1, 3), .16)
    snare_w(wp, (1, 3), .1)
    hat16_w(wp, .038, .019)
    hat_off = [tb(b, 3.5) for b in (43, 44, 45)]
    for t_ in hat_off:
        hat(t_, .03, 1)
    shaker_w(wp, .016, .3)
    sub_w(wp, .15, rel=.1, shorten=.05)
    bass8_w(wp, .17, 450, patt=(0, 0, 12, 0, 0, 12, 7, 12), base=12, off=.78)
    cello8_w(wp, .028, up=24, osc=(0, 0, 7, 0, 0, 7, 12, 7))
    arpw(wp, SIXTEENTH, [P16A, P16B], i_marimba, 60, 91, .058, vel_pat=(1, .55, .8, .55))
    arpw(wp, SIXTEENTH, [P16B, P16A], i_pluck, 67, 95, .045, vel_pat=(1, .5, .75, .5))
    motif(tb(44), MOT_QG, i_bell, tr=12, gain=.026, vel=.8, dec=1.4)
    motif(tb(44), MOT_QG, i_strlead, gain=.034, vel=.8)
    taiko(tb(44), .12, .3)
    taiko(tb(45, 3), .12, .3)
    snare_roll(tb(45, 2), tb(46), .03, .18)
    riser(tb(46), BAR, .085, f0=200)
    crash_rev(tb(46), 1.6, .064)


def s_teach():
    """bars 46-55 (115-140 s): release and warmth, felt piano + pad + a gentle beat.  Questioning, sparse (115-121.9); warmer (121.9-128.75:
    broken chords, kalimba glass, soft kick); strings build (128.75-136.25); warm resolved C major chord (136.25-140)."""
    t = tb(46)
    i_subnote(t, 33, 2.0, .16, att=.05, rel=.5)                                                   # the peak is let go: one low breath and the felt piano
    for k, m in enumerate([45, 57, 64, 67, 72]):
        i_felt(t + .02 + k * .045, m, gain=.07 - k * .006, pan=(k - 2) * .15, vel=.62)
    crash(t, .03, 2.6)
    # --- questioning, sparse 115-121.875
    wq = (tb(46), tb(48, 3))
    gpad = lambda t: ramp(t, tb(46), tb(54, 2), .9, 1.35)
    pads_w((tb(46), tb(51, 2)), gain=.02, att=1.6, rel=1.2, gf=gpad)
    pads_w((tb(51, 2), tb(54, 2)), gain=.02, att=1.6, rel=1.2, gf=gpad, voic=open_voic)
    sub_w(wq, .11, rel=.3, shorten=.2)
    motif(tb(46, 2) + .004, MOT_Q, i_felt, gain=.056, vel=.72)                                    # the question on a warm piano, hanging on the 5th
    motif(tb(46, 2), MOT_Q, i_bell, tr=12, gain=.014, vel=.6, dec=1.6)
    for t_, i in grid((tb(47), tb(48, 3)), BEAT):
        pl = pool(chord_at(t_), 60, 76)
        i_felt(t_, pl[[0, 1, 2, 3][i % 4]], gain=.038, vel=.42 + .06 * (i % 2 == 0), pan=np.sin(i) * .3)
    i_felt(tb(47), chord_root_midi(47) + 12, gain=.05, vel=.6)
    kicks_w((tb(47), wq[1]), (0,), .12, .25)
    shaker_w((tb(47, 2), wq[1]), .012, .2)
    i_bell(tb(48, 3), 88, gain=.026, pan=.2, dec=2.0)                                              # the C of 121.875: the colour warms
    # --- warmer 121.875-128.75
    ww = (tb(48, 3), tb(51, 2))
    rg = R(32, 1)
    for t_, i in grid(ww, EIGHTH):
        pl = pool(chord_at(t_), 57, 81)
        patt = [0, 2, 1, 3, 2, 4, 3, 2] if int(t_ // BAR) % 2 == 0 else [0, 3, 2, 4, 1, 3, 2, 5]
        i_felt(t_ + rg.normal(0, .005), pl[patt[i % 8] % len(pl)], gain=.038, pan=np.sin(i + 5) * .3, vel=.42 + .22 * (i % 2 == 0) + .05 * rg.random())
    for t_, i in grid(ww, BAR):
        r = ROOT[chord_at(t_)]
        i_felt(t_, r + 12, gain=.052, vel=.62)
        i_felt(t_ + 2 * BEAT, r + 19, gain=.04, vel=.5)
    sub_w(ww, .13, rel=.3, shorten=.1)
    kicks_w(ww, (0, 2), .2, .35)
    shaker_w(ww, .016, .25)
    rim_w(ww, (3,), .02)
    hat8_w((tb(50), ww[1]), .01)
    arpw(ww, EIGHTH, [P8G], i_kalimba, 72, 96, .022)
    motif(tb(49) + .004, MOT_Q, i_felt, gain=.056, vel=.75)
    motif(tb(50) + .004, MOT_QG, i_kalimba, tr=12, gain=.04, vel=.8, dec=.9)
    bell_dots(ww, BEAT * 3, 49, g=.016, lo=84, hi=98, dec=1.8)
    # --- strings build 128.75-136.25
    wsb = (tb(51, 2), tb(54, 2))
    strs_w(wsb, gain=.028, att=1.4, rel=1.0, gf=lambda t: ramp(t, wsb[0], wsb[1], .7, 1.6))
    sub_w(wsb, .14, rel=.3, shorten=.1)
    bass8_w(wsb, .06, 600, gf=lambda t: ramp(t, wsb[0], wsb[1], 1.0, 1.5), patt=(0, 0, 12, 0, 0, 12, 7, 12))
    kicks_w(wsb, (0, 2), .2, .35, gf=lambda t: ramp(t, wsb[0], wsb[1], 1.0, 1.4))
    kicks_w((tb(53), wsb[1]), (1, 3), .1, .25)
    shaker_w(wsb, .018, .3)
    hat8_w(wsb, .02)
    clap_w((tb(53), wsb[1]), (1, 3), .045, gf=lambda t: ramp(t, tb(53), wsb[1], 1.0, 1.8))
    arpw(wsb, EIGHTH, [P8A, P8B], i_kalimba, 67, 93, .03)
    arpw((tb(52), wsb[1]), EIGHTH, [P8G], i_pluck, 67, 93, .024)
    rg = R(32, 2)
    for t_, i in grid(wsb, EIGHTH):
        pl = pool(chord_at(t_), 57, 79)
        i_felt(t_ + rg.normal(0, .005), pl[[0, 2, 1, 3, 2, 4, 3, 2][i % 8] % len(pl)], gain=.03, pan=np.sin(i + 5) * .3, vel=.4 + .18 * (i % 2 == 0))
    for k, (t_, i) in enumerate(grid(wsb, BAR)):
        pl = pool(chord_at(t_), 64, 81)
        i_strlead(t_, pl[(k + 2) % len(pl)], BAR * .9, gain=.034, vel=.85)
    snare_roll(tb(54, 0), wsb[1], .02, .09)
    crash_rev(wsb[1], 1.2, .04)
    # --- warm resolved chord 136.25-140
    t = wsb[1]
    kick(t, .26, .5)
    i_subnote(t, 36, 3.2, .24, att=.02, rel=.5)
    pad(t, [48, 55, 60, 64, 71, 74], 3.6, gain=.04, att=.2, rel=1.0, spread=.9)
    strpad(t, [48, 60, 67, 76, 79, 83], 3.4, gain=.03, att=.3, rel=1.0)
    for k, m in enumerate([48, 55, 64, 71, 74, 79]):
        i_felt(t + k * .04, m, gain=.068, pan=(k - 2.5) * .15, vel=.66)
    for k, m in enumerate([88, 83, 79, 76, 91]):
        i_bell(t + .2 + k * .3, m, gain=.024 - k * .0016, pan=(k % 4 - 1.5) * .3, dec=2.4)
    for t_, i in grid((t + 1.25, tb(56)), EIGHTH):
        pl = pool('C', 60, 84)
        i_felt(t_ + rg.normal(0, .005), pl[[0, 2, 3, 4, 3, 2][i % 6] % len(pl)], gain=.032, pan=np.sin(i) * .3, vel=.4 + .12 * (i % 2 == 0))
    kicks_w((tb(55), tb(56)), (0, 2), .15, .3)
    shaker_w((tb(55), tb(56)), .014, .25)


def chord_root_midi(bar):
    return ROOT[chord_at(tb(bar))]


def s_chat():
    """bars 56-61 (140-155 s): a clean light pulse (soft four-on-the-floor, pluck / kalimba 8ths, closed hats) in C / Am / F / G; from 148.125 s
    slightly uneasy (Dm / Asus / Gsus: no kick, a low D drone, held cello, the question again, a soft riser); resolves at 155 s."""
    wc, wu = (tb(56), tb(59, 1)), (tb(59, 1), tb(62))
    pads_w((tb(56), tb(59, 1)), gain=.026, att=.8, rel=.9)
    sub_w(wc, .13, rel=.2, shorten=.1)
    kicks_w(wc, (0, 1, 2, 3), .1, .25)
    hat8_w(wc, .03)
    shaker_w(wc, .018, .3)
    clap_w(wc, (3,), .02)
    arpw(wc, EIGHTH, [[0, 2, 1, 3, 2, 4, 1, 3], [0, 3, 1, 4, 2, 3, 1, 2]], i_pluck, 62, 88, .034)
    arpw(wc, EIGHTH, [P8G], i_kalimba, 72, 100, .026)
    for t_, i in grid(wc, EIGHTH):
        if i % 4 == 3:
            i_bassnote(t_, ROOT[chord_at(t_)] + 12 + (7 if (i // 8) % 2 else 0), EIGHTH * .9, .06)
    bell_dots(wc, BEAT * 2, 56, g=.016, lo=84, hi=100)
    motif(tb(57), MOT_Q, i_kalimba, gain=.05, vel=.85, pan=.15, dec=.9)
    motif(tb(58), MOT_Q, i_bell, tr=12, gain=.02, vel=.8, dec=1.4)
    # uneasy
    pads_w(wu, gain=.024, att=1.2, rel=1.0, gf=lambda t: ramp(t, wu[0], wu[1], .9, 1.2))
    strs_w(wu, gain=.024, att=1.2, rel=.9, low=True, gf=lambda t: ramp(t, wu[0], wu[1], .8, 1.4))
    sub_w(wu, .12, rel=.3, shorten=.15)
    for t_ in [wu[0]] + [x for x, _ in grid(wu, BAR)]:
        r = ROOT[chord_at(t_)]
        i_strlead(t_ + .02, r + 24, BAR - .15, gain=.03, vel=.65)                                    # a long cello-ish note: the pulse thins into held tones
    kicks_w((tb(59, 1), tb(60)), (1, 3), .06, .2)
    hat8_w(wu, .016)
    data_hats(wu, 59, p=.3, g=.014)
    arpw((tb(59, 1), tb(61)), EIGHTH, [[0, None, 2, None, 1, None, 3, None]], i_pluck, 62, 88, .026)
    motif(tb(60), MOT_Q, i_kalimba, tr=-5, gain=.044, vel=.75, pan=-.1, dec=.9)                       # the question once more, lower (over Asus / Dm9)
    motif(tb(60), MOT_Q, i_felt, tr=-5, gain=.04, vel=.5)
    for k, m in enumerate([86, 83, 79, 74]):
        i_kalimba(tb(61, 2) + k * EIGHTH, m, gain=.014, pan=(k - 1.5) * .3, vel=.55, dec=.8)
    riser(tb(62), 2.5, .045, f0=240, pw=2.6)
    crash_rev(tb(62), 1.2, .03)


def s_finale():
    """bars 62-67 (155-170 s): resolved at 155 (pad swell, the motif answered over strings: it lands on the tonic), a growing beat to 163.5,
    a sparse collapse to the title hit at 165.0 s (80 ms gap, then C major with kick, taiko, crash), the final tonic rings and fades to silence."""
    t0 = tb(62)
    crash(t0, .05, 2.6)
    i_subnote(t0, 36, 2.4, .2, att=.3, rel=.4)
    pad(t0, [48, 55, 60, 64, 71], BAR * 1.0, gain=.034, att=2.0, rel=.9, spread=.9)
    strpad(t0, [48, 60, 67, 76, 79], BAR * 1.0, gain=.028, att=2.0, rel=.9)
    wa = (tb(63), tb(65, 2))
    pads_w(wa, gain=.036, att=.5, rel=.9, gf=lambda t: ramp(t, wa[0], wa[1], 1.0, 1.4), voic=open_voic)
    strs_w(wa, gain=.03, att=.7, rel=.9, open_=True, gf=lambda t: ramp(t, wa[0], wa[1], 1.0, 1.5))
    motif(tb(62), MOT_R, i_strlead, gain=.045, vel=.9)                                              # THE ANSWER: A C E D, then C held on the tonic
    motif(tb(62), MOT_R, i_bell, tr=12, gain=.022, vel=.8, dec=1.6)
    motif(tb(62), MOT_R, i_felt, gain=.055, vel=.7)
    motif(tb(64), MOT_R, i_strlead, gain=.05, vel=.95)
    motif(tb(64), MOT_R, i_bell, tr=12, gain=.026, vel=.9, dec=2.0)
    motif(tb(64), MOT_R, i_felt, tr=-12, gain=.06, vel=.75)
    bell_dots((tb(62, 2), tb(64)), BEAT, 62, g=.016, lo=84, hi=100, p=.6, dec=1.8)
    wsub = (tb(62), tb(65, 2))
    sub_w(wsub, .15, rel=.2, shorten=.1)
    # the beat grows: heartbeat -> pulse -> full
    kicks_w((tb(62, 2), tb(63)), (0, 2), .16, .3)
    kicks_w((tb(63), tb(64)), (0, 1, 2, 3), .24, .4)
    kicks_w((tb(64), tb(65, 2)), (0, 1, 2, 3), .34, .5)
    clap_w((tb(63, 2), tb(65, 2)), (1, 3), .08, gf=lambda t: ramp(t, tb(63, 2), tb(65, 2), .8, 1.4))
    shaker_w((tb(62, 2), tb(65, 2)), .016, .3)
    hat8_w((tb(63), tb(64)), .02)
    hat16_w((tb(64), tb(65, 2)), .03, .015)
    bass8_w((tb(63), tb(65, 2)), .08, 550, gf=lambda t: ramp(t, tb(63), tb(65, 2), 1.0, 1.5))
    arpw((tb(62, 2), tb(64)), EIGHTH, [P8A, P8B], i_marimba, 60, 88, .036)
    arpw((tb(64), tb(65, 2)), SIXTEENTH, [P16A, P16B], i_marimba, 60, 91, .042, vel_pat=(1, .55, .8, .55))
    arpw((tb(63), tb(65, 2)), EIGHTH, [P8G], i_pluck, 67, 95, .028)
    taiko(tb(64), .12, -.2)
    snare_roll(tb(65), tb(65, 2), .02, .12)
    # 163.5-165: the picture collapses to a blinking caret: one pad, two glass blinks
    for t_, g in ((tb(65, 2.5), .026), (tb(65, 3.5), .02)):
        i_bell(t_, 79, gain=g, pan=.1, dec=1.4)
        i_kalimba(t_, 91, gain=g * .6, pan=-.1, vel=.7, dec=.6)
    pad(tb(65, 2), VOIC['Gsus'], tb(66) - tb(65, 2) + .1, gain=.026, att=.3, rel=.3)
    i_subnote(tb(65, 2), 31, 1.4, .1, att=.2, rel=.3)
    riser(tb(66), 1.4, .045, f0=200, pw=2.8)
    DIPS.append((tb(66), .08))
    # the title hit and the last chord
    t = tb(66)
    kick(t, .5, .6)
    taiko(t, .22, .2)
    crash(t, .07, 2.8)
    i_subnote(t, 36, 3.0, .27, att=.02, rel=1.0)
    pad(t, [48, 55, 60, 64, 71, 74], 3.0, gain=.044, att=.12, rel=1.2, spread=.9)
    strpad(t, [48, 60, 67, 76, 79, 83], 2.9, gain=.032, att=.25, rel=1.2)
    for k, m in enumerate([48, 55, 64, 71, 74, 79]):
        i_felt(t + k * .03, m, gain=.07, pan=(k - 2.5) * .15, vel=.72)
    for k, m in enumerate([88, 83, 79, 76, 91, 86, 83, 95]):
        i_bell(t + .35 + k * .24, m, gain=.026 - k * .0013, pan=(k % 4 - 1.5) * .3, dec=2.6)
    motif(t + .6, MOT_R[:3], i_felt, tr=12, gain=.03, vel=.5)


def score():
    s_hook()
    s_tokens()
    s_vectors()
    s_attention()
    s_predict()
    s_read()
    s_learn()
    s_teach()
    s_chat()
    s_finale()


# ================================================================== sound effects from the cue sheet
PENT_PC = (9, 0, 2, 4, 7)                  # A minor pentatonic
PENT_E = (9, 11, 2, 4, 8)                  # over an E7: G natural would clash with the G#, so A B D E G#
PENT_G = (9, 11, 2, 4, 7)                  # over a G major chord: C would be an avoid-note against its B, so A B D E G


def pent_of(chord):
    return PENT_E if chord == 'E' else PENT_G if chord == 'G' else PENT_PC
LAST_SNAP = {}


def snap(m, t=None, key=None):
    """snap a cue pitch to the pentatonic of the chord sounding at t (A C D E G, or A B D E G# over E7); consecutive
    cues of the same name never end up on the same pitch unless the sheet asked for the same pitch twice."""
    raw = int(round(m))
    pcs = pent_of(chord_at(t)) if t is not None else PENT_PC
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
T_BLIP = .8
T_POP = 10 ** (8.5 / 20)
T_PING = 10 ** (1.5 / 20)
T_SWELL = 10 ** (5 / 20)          # the swell sits on top of the pad: it needs a real tonal body
T_LOUD = 1 / SFX_GAIN        # hit / boom / stamp / glitch keep their old absolute level


SMALL = ('type', 'chip', 'tick', 'blip', 'step', 'count')
DENSE_NAMES = ('type', 'chip', 'tick', 'blip')
DENSE_RATE = 7.0
# trim of the small UI cues (dB) per section of the bed: the dense sections (dark 27.5-35, peak 35-42.5, finale 50-57.5) bury a -3 dB tick
SMALL_TRIM = [(0, 0.0), (25, 1.0), (31.25, 2.0), (40, 0.0), (48.75, 2.0), (53.75, 1.0), (60, 0.0), (74.375, 2.0), (80, 3.0), (87.5, 2.0), (92.5, 3.0), (95, 1.0),
              (101.25, 3.0), (108.75, 4.0), (115, 0.0), (128.75, 1.5), (136.25, 0.0), (140, 1.0), (155, 2.0), (163.5, 0.0)]


PRETTY = ('ping', 'ding', 'chime', 'sparkle', 'whoosh', 'swish', 'pop', 'down')
PRETTY_TRIM = [(53.75, 60.0, 10 ** (-2.0 / 20)), (108.75, 115.0, 10 ** (-3.5 / 20)), (155.0, 163.5, 10 ** (-3.5 / 20))]     # glass pings / dings / whooshes on a bed that is already near its loudest: a few dB softer so the mix never beats the learn peak


def small_trim(t):
    db = 0.0
    for t0, d in SMALL_TRIM:
        if t >= t0:
            db = d
    return 10 ** (db / 20)


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


def root_hz(t, lo=40.0):
    """root of the chord sounding at t (+10 ms), an octave up while it is under `lo` Hz: the low end of hit / boom / stamp is
    tuned to it (an untuned 46 / 52 Hz pair beat 2-8 Hz against the F sub of the title bloom)."""
    f = midi(ROOT[chord_at(t + .01)])
    while f < lo:
        f *= 2
    return round(float(f), 1)


@lru_cache(maxsize=None)
def w_hit(f0=46.0):
    t = tv(1.4)
    f = f0 + 70 * np.exp(-t / .03)
    s = np.tanh(2 * np.sin(TAU * np.cumsum(f) / SR)) * np.exp(-t / .3)
    s += .35 * np.sin(TAU * f0 * t) * np.exp(-t / .6)
    s += .5 * hp(nz(len(t), 44), 1800) * np.exp(-t / .03) + .3 * lp(nz(len(t), 45), 900) * np.exp(-t / .12)
    return s.astype(F32)


def fx_hit(t, k=.6, g=1.0, **o):
    k = float(np.clip(k, 0, 1.2))
    put(w_hit(root_hz(t)), t, 'sfx', .62 * T_LOUD * k * g, wet=.35, fade=.12)
    tt = tv(1.2)
    met = sum(np.sin(TAU * f * tt) * np.exp(-tt / d) for f, d in ((1390, .3), (2310, .2), (3710, .12)))
    put(met, t, 'sfx', .04 * T_LOUD * k * g, wet=.6, fade=.1)
    put(whoosh_sig(.22, 800, 6000, rev=True, seed=7), t - .22, 'sfx', .12 * T_LOUD * k * g, fade=.006)
    HITS.append((t, .38 * k))
    KICKS.append((t, .35 * k))


def fx_boom(t, g=1.0, **o):
    f0 = root_hz(t, 36.0)
    s, tt = sweep_sine(1.7 * f0, f0, 2.6)
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
def w_stamp(f0=48.0):
    s, tt = sweep_sine(2.3 * f0, f0, .5)
    return (s * np.exp(-tt / .12) + bp(nz(len(tt), 52), 200, 900) * np.exp(-tt / .05) + .6 * hp(nz(len(tt), 53), 2000) * np.exp(-tt / .018)).astype(F32)


def fx_stamp(t, g=1.0, **o):
    put(w_stamp(root_hz(t)), t, 'sfx', .42 * T_LOUD * g, .1, wet=.3, fade=.08)
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
    dense = sorted(tkey(c) for c in cues if isinstance(c, dict) and c.get('name') in DENSE_NAMES)
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
        if name in SMALL:
            o['g'] = o.get('g', 1.0) * small_trim(t)
            if name in DENSE_NAMES:                                    # constant-power rule: above DENSE_RATE small cues per second the run gets no louder
                d = (bisect.bisect_right(dense, t + .25) - bisect.bisect_left(dense, t - .25)) / .5
                o['g'] *= min(1.0, (DENSE_RATE / max(d, 1e-9)) ** .5)
            CUE_DUCKS.append((t, 1.0))
        elif name in PRETTY:
            for t0, t1, gg in PRETTY_TRIM:
                if t0 <= t < t1:
                    o['g'] = o.get('g', 1.0) * gg
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


def _steps(pairs, lead=.08):
    """filter automation: (t, hz) pairs; a 's' flag steps (an 80 ms glide into the new value at t), otherwise a log-linear glide from the previous knot."""
    out = []
    for p in pairs:
        t, hz = p[0], p[1]
        if len(p) > 2 and out:
            out.append((max(t - lead, out[-1][0] + 1e-3), out[-1][1]))
        out.append((t, hz))
    return out


# (t, hz[, 's']): 's' = a step at t (the filter jumps within 80 ms), otherwise a glide from the previous knot
PAD_CUT = _steps([(0, 600), (3, 1300), (6.2, 1700), (6.25, 5500, 's'), (9.9, 4200), (10, 3800, 's'), (24.9, 3600), (25, 3000, 's'), (31.25, 5000), (36, 7000), (39.9, 9000),
                  (40, 2200, 's'), (48.7, 2400), (48.75, 3600, 's'), (53.7, 4000), (53.75, 5500, 's'), (59.9, 9000), (60, 8000, 's'), (68.05, 7000), (68.125, 1800, 's'), (71.2, 2400), (71.25, 4500, 's'), (74.3, 5000),
                  (74.375, 6500, 's'), (79.9, 6000), (80, 1300, 's'), (87.4, 1500), (87.5, 2600, 's'), (92.4, 2800), (92.5, 3400, 's'), (94.9, 4500), (95, 1500, 's'), (101.2, 1800),
                  (101.25, 2400, 's'), (108.7, 3500), (108.75, 6000, 's'), (114.9, 6500), (115, 2000, 's'), (121.8, 2600), (121.875, 3600, 's'), (128.7, 4000), (128.75, 4500, 's'),
                  (136.2, 6500), (136.25, 6500, 's'), (139.9, 6000), (140, 5000, 's'), (148.1, 4500), (148.125, 2800, 's'), (154.9, 3500), (155, 6500, 's'), (163.4, 6500), (163.5, 3500, 's'),
                  (164.9, 4500), (165, 7000, 's'), (170, 3500), (175, 3500)])
STR_CUT = _steps([(0, 1500), (3, 2000), (6.2, 2500), (6.25, 6500, 's'), (10, 3500), (25, 2800), (31.25, 4500), (39.9, 8000), (40, 2400, 's'), (48.75, 3200, 's'), (53.75, 5000, 's'),
                  (59.9, 8500), (60, 7000, 's'), (68.125, 1800, 's'), (71.25, 4000, 's'), (74.375, 6000, 's'), (80, 1800, 's'), (87.5, 2600, 's'), (92.5, 3500, 's'), (95, 1800, 's'), (101.25, 2800, 's'),
                  (108.75, 6500, 's'), (115, 2200, 's'), (121.875, 3200, 's'), (128.75, 4000, 's'), (136.2, 7000), (136.25, 7000, 's'), (140, 5500, 's'), (148.125, 3000, 's'),
                  (155, 6500, 's'), (163.5, 3500, 's'), (165, 7000, 's'), (175, 3500)])


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


CUE_DUCK_DEPTH = .4
SFX_ARC = .5               # the sfx follow the loudness arc at this fraction (in dB): the cue sheet is dense in the quiet sections too, and a flat sfx bus would flatten the arc of the whole mix


def arc_gain():
    """loudness arc: a smooth gain curve (dB breakpoints, linear in between, 25 ms smoothing so steps are never clicks) applied to the
    bed AND the sfx before the master.  The master then levels the whole piece to -14 LUFS, so only the differences matter."""
    pts = np.array(ARC, float)
    g = 10 ** (np.interp(np.arange(N) / SR, pts[:, 0], pts[:, 1]) / 20)
    return uniform_filter1d(g, int(.025 * SR)).astype(F32)


# calibrated against the real cue sheet (K-weighted momentary loudness, bed median per bar): bars 0-1 -11 dB re the peak, groove -6, build -9 / -7 / -4.7,
# aha -5.2, dark -7.7 / -7.7 / -7.2, PEAK 0, release -7.5 / -7.5 / -6.5, finale -2.5 / -1.4 / -1.4; bar 1 has its own step down at the title bloom (3.125 s)
ARC = [
    (0.000, -9.06), (3.100, -9.06), (6.199, -9.06), (6.251, -14.49), (6.875, -14.49), (7.499, -14.49), (7.501, -11.67), (8.750, -11.67),
    (9.999, -11.67), (10.001, -3.54), (11.250, -3.54), (13.750, -7.94), (16.250, -5.56), (18.750, -9.13), (21.250, -5.55), (23.750, -3.88),
    (24.999, -3.88), (25.001, -5.48), (26.250, -5.48), (29.375, -10.00), (33.125, -9.96), (36.250, -8.44), (38.750, -3.73), (39.999, -3.73),
    (40.001, -4.46), (41.250, -4.46), (43.750, -9.12), (46.250, -9.19), (48.125, -7.40), (48.749, -7.40), (48.751, -4.81), (50.000, -4.81),
    (52.500, -5.12), (53.749, -5.12), (53.751, -3.36), (54.375, -3.36), (56.250, -7.11), (58.750, -6.62), (59.999, -6.62), (60.001, -9.64),
    (61.250, -9.64), (63.750, -7.70), (66.250, -7.68), (67.800, -7.79), (68.099, -7.79), (68.126, -5.39), (69.688, -5.39), (71.249, -5.39),
    (71.251, -8.10), (72.812, -8.10), (74.374, -8.10), (74.376, -9.36), (75.938, -9.36), (78.750, -5.97), (79.999, -5.97), (80.001, -4.11),
    (81.250, -4.11), (83.750, -4.71), (86.250, -4.73), (87.499, -4.73), (87.501, -6.47), (88.750, -6.47), (91.250, -3.11), (92.499, -3.11),
    (92.501, -6.62), (93.750, -6.62), (94.999, -6.62), (95.001, -1.39), (96.500, -1.39), (99.625, -3.82), (101.249, -3.82), (101.251, -3.68),
    (102.500, -3.68), (105.000, -3.87), (107.500, -3.55), (108.749, -3.55), (108.751, 0.77), (110.000, 0.77), (113.125, 0.31), (114.999, 0.31),
    (115.001, -9.64), (116.750, -9.64), (120.188, -4.33), (121.874, -4.33), (121.876, -9.01), (123.588, -9.01), (127.025, -8.45), (128.749, -8.45),
    (128.751, -5.74), (130.625, -5.74), (134.375, -6.25), (136.249, -6.25), (136.251, -8.24), (138.125, -8.24), (139.999, -8.24), (140.001, -5.96),
    (142.000, -5.96), (146.062, -6.30), (148.124, -6.30), (148.126, -2.49), (149.812, -2.49), (153.250, -3.03), (154.999, -3.03), (155.001, -6.15),
    (156.250, -6.15), (158.750, 0.45), (161.750, -3.66), (163.499, -3.66), (163.501, -9.36), (164.250, -9.36), (164.999, -9.36), (165.001, -7.34),
    (166.500, -7.34), (168.750, -1.36), (169.499, -1.36), (169.900, -1.36), (175.000, -1.36),
]


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
    if CUE_DUCKS:                                                    # the small cues sit in 1.5-9 kHz: duck only that band of the bed (about -4 dB, 70 ms) under them
        cd = duck_curve(CUE_DUCKS, .07, .35) * CUE_DUCK_DEPTH
        bed = bed - bp_st(bed, 1500, 9000, 1) * cd
    arc = arc_gain()
    bed, sfx = bed * dg * arc, (BUS['sfx'] + wet_sfx) * dg * arc ** SFX_ARC
    return bed, ride_sfx(bed, sfx)


SFX_CAP_DB = 6.0           # a dense run of cues may be at most this much louder (0.4 s rms, above 800 Hz) than the bed's own top end
SFX_CAP_FLOOR = 10 ** (-42 / 20)     # ... but a near-silent bed (the opening typing) never takes the cues away
SFX_CAP_MAX_CUT = .35


def ride_sfx(bed, sfx, win=.4):
    """keeps dense sfx runs under the bed: the part of the sfx above 800 Hz is turned down (at most -9 dB) while its 0.4 s rms is more than
    SFX_CAP_DB over the bed's (the lows, hence the weight of hits and booms, are untouched)."""
    k = int(win * SR)
    hs, hb = hp_st(sfx, 800), hp_st(bed, 800)
    rs = np.sqrt(np.maximum(uniform_filter1d((hs.astype(np.float64) ** 2).mean(0) * SFX_GAIN ** 2, k), 0))
    rb = np.sqrt(np.maximum(uniform_filter1d((hb.astype(np.float64) ** 2).mean(0) * BED_GAIN ** 2, k), 0))
    g = np.clip(np.maximum(rb, SFX_CAP_FLOOR) * 10 ** (SFX_CAP_DB / 20) / (rs + 1e-9), SFX_CAP_MAX_CUT, 1.0)
    g = uniform_filter1d(g, int(.05 * SR)).astype(F32)
    return sfx - hs * (1 - g)


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


def k_weight(x):
    """ITU-R BS.1770 K-weighting (high shelf + RLB high-pass) of a (2, n) signal."""
    A = 10 ** (3.999843853973347 / 40)
    w = 2 * np.pi * 1681.974450955533 / SR
    al = np.sin(w) / (2 * 0.7071752369554196)
    c, q = np.cos(w), 2 * np.sqrt(A) * al
    sh = ([A * ((A + 1) + (A - 1) * c + q), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - q)],
          [(A + 1) - (A - 1) * c + q, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - q])
    K = np.tan(np.pi * 38.13547087602444 / SR)
    d = 1 + K / 0.5003270373238773 + K * K
    hpf = ([1, -2, 1], [d, 2 * (K * K - 1), 1 - K / 0.5003270373238773 + K * K])
    y = lfilter(sh[0], sh[1], x.astype(np.float64), axis=1)
    return lfilter(hpf[0], hpf[1], y, axis=1)


def lufs_np(mix):
    """integrated loudness, BS.1770-4 with both gates (400 ms blocks, 75 % overlap): numpy twin of ffmpeg's ebur128 / loudnorm, used when
    ffmpeg is missing (agrees with it to about 0.1 LU)."""
    z = k_weight(mix) ** 2
    L, h = int(.4 * SR), int(.1 * SR)
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(z, axis=1)], axis=1)
    st = np.arange(0, z.shape[1] - L + 1, h)
    p = (cs[:, st + L] - cs[:, st]).sum(axis=0) / L
    lk = -.691 + 10 * np.log10(p + 1e-12)
    ok = lk > -70
    if not ok.any():
        return -70.0
    rel = -.691 + 10 * np.log10(p[ok].mean()) - 10
    ok = lk > max(-70, rel)
    return float(-.691 + 10 * np.log10(p[ok].mean() + 1e-12))


def lufs(mix, tmp):
    """integrated loudness (ffmpeg loudnorm measurement of a temporary wav; the numpy twin when ffmpeg is missing)."""
    if not shutil.which('ffmpeg'):
        return lufs_np(mix)
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
    """wav -> mp3 (256 kbps CBR).  The wav is already levelled (-14 LUFS, TP -2 dBTP) and is encoded as it is: NO loudnorm here, because ffmpeg's
    loudnorm falls back to its *dynamic* mode when the true peak of the source is above its TP target, which flattens the whole loudness arc
    (quiet sections +3..+6 dB).  A -2.3 dB sample-peak limiter keeps LAME's inter-sample overshoot (about 1 dB) under -1.2 dBTP."""
    if not shutil.which('ffmpeg'):
        raise FileNotFoundError('ffmpeg')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav, '-af', 'loudnorm=I=-14:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])                     # a measurement only (for the log)
    n = int(round(TOTAL))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', f'alimiter=limit=-2.3dB:level=false,atrim=0:{n},apad=whole_dur={n}',
                    '-ar', str(SR), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '256k', mp3], check=True)
    return m


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--cues', default=os.path.join(here, 'cues.json'), help='cue sheet JSON: [{"t": seconds, "name": cue, ...opts}]')
    ap.add_argument('--out-dir', default=here, help='directory for music.wav and music.mp3')
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    if not shutil.which('ffmpeg'):
        print('ERROR: ffmpeg was not found on PATH.  It is needed for the mp3 encode (install ffmpeg, e.g. apt install ffmpeg); '
              'continuing: music.wav will still be rendered and levelled with the built-in loudness meter, but music.mp3 will not be written.', file=sys.stderr)

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
    try:
        m = encode(wav, mp3)
        print(f"music: {mix.shape[1] / SR:.2f}s  wav {m['input_i']} LUFS / {m['input_tp']} dBTP -> {mp3}")
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        print(f'ERROR: could not encode music.mp3 ({e}); music.wav was written ({lufs_np(mix):.2f} LUFS by the built-in meter) but the mp3 deliverable is missing', file=sys.stderr)
        sys.exit(2)
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
