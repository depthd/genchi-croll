"""Render an original 16-bar sound sketch using synthesized instruments.

Requires Python 3, NumPy, SciPy, and FFmpeg.
"""
from pathlib import Path
import subprocess

import numpy as np
from scipy import ndimage, signal

RATE = 48_000
TEMPO = 100
BARS = 16
BEAT = RATE * 60 / TEMPO
STEP = BEAT / 4
MUSIC_LENGTH = round(BARS * 16 * STEP)
LENGTH = MUSIC_LENGTH + round(RATE * 1.6)
TAU = np.pi * 2
RANDOM = np.random.default_rng(76193)
OUTPUT = Path(__file__).resolve().parent / "renders"
OUTPUT.mkdir(exist_ok=True)

names = ("kick", "snare", "hats", "metal", "bass", "sub", "hook", "texture")
tracks = {name: np.zeros((LENGTH, 2), dtype=np.float32) for name in names}
kick_events = []


def time(duration, rate=RATE):
    return np.arange(round(duration * rate), dtype=np.float64) / rate


def pitch(note):
    return 440 * 2 ** ((note - 69) / 12)


def filtered(audio, cutoff, kind, order=2, rate=RATE):
    return signal.sosfilt(
        signal.butter(order, cutoff, btype=kind, fs=rate, output="sos"),
        audio, axis=0,
    )


def edges(t, attack=.003, release=.025):
    attack_curve = np.sin(np.minimum(1, t / attack) * np.pi / 2) ** 2
    release_curve = np.sin(np.minimum(1, (t[-1] - t) / release) * np.pi / 2) ** 2
    return attack_curve * release_curve


def noise(t, low, high, rate=RATE):
    return filtered(RANDOM.standard_normal(len(t)), (low, high), "bandpass", rate=rate)


def normalize(sound, rms):
    return sound * rms / max(np.sqrt(np.mean(sound ** 2)), 1e-9)


def position(bar, step, delay=0):
    return round((bar * 16 + step) * STEP + delay * RATE)


def place(name, start, sound, level=1, pan=0):
    if sound.ndim == 1:
        sound = sound[:, None]
    gains = np.sqrt(1 + np.array((-pan, pan))) * level
    count = min(len(sound), LENGTH - start)
    tracks[name][start:start + count] += (sound[:count] * gains).astype(np.float32)


def oversampled_drive(audio, gain):
    oversampled = signal.resample_poly(audio, 2, 1, axis=0)
    saturated = np.tanh(gain * oversampled)
    return signal.resample_poly(saturated, 1, 2, axis=0)[:len(audio)]


def periodic_wave(phase, cutoff, fundamental, pulse=False):
    wave = np.zeros_like(phase)
    harmonics = min(100, int(18000 / fundamental))
    for harmonic in range(1, harmonics + 1):
        amplitude = 1 / harmonic
        if pulse:
            amplitude *= np.sin(np.pi * harmonic * .39)
        rolloff = 1 / np.sqrt(1 + (harmonic * fundamental / cutoff) ** 8)
        wave += np.sin(harmonic * phase) * amplitude * rolloff
    return wave


def bass_note(note, duration, accent):
    t = time(duration + .037)
    f = pitch(note)
    cutoff = 1130 + 1380 * np.exp(-t / .065) * accent
    phase_a = TAU * f * t + .23
    phase_b = TAU * f * 1.0032 * t + 1.17
    saw = .78 * periodic_wave(phase_a, cutoff, f)
    saw += .36 * periodic_wave(phase_b, cutoff * 1.1, f, pulse=True)
    preamp = filtered(saw, 140, "highpass")
    driven = oversampled_drive(preamp, 2.0)
    driven = filtered(driven, (175, 5900), "bandpass")
    definition = filtered(driven, (740, 2300), "bandpass") * .86
    envelope = edges(t, .004, .035) * (.82 + .18 * np.exp(-t / .07))
    middle = (driven + definition) * envelope
    low = np.sin(TAU * f / 2 * t + .23) * edges(t, .009, .043)
    return normalize(middle, .34), normalize(low, .48)


def kick():
    t = time(.28)
    phase = TAU * (52 * t + 124 * .009 * (1 - np.exp(-t / .009)))
    body = np.sin(phase) * np.exp(-t / .081)
    punch = .29 * np.sin(TAU * 126 * t + .1) * np.exp(-t / .019)
    click = noise(t, 2100, 6800) * np.exp(-t / .003) * .19
    signal_in = (body + punch + click) * edges(t, .0007, .038)
    return normalize(filtered(oversampled_drive(signal_in, 1.25), 29, "highpass"), .42)


def snare():
    t = time(.30)
    phase = TAU * (184 * t + 48 * .007 * (1 - np.exp(-t / .007)))
    body = .50 * np.sin(phase) * np.exp(-t / .045)
    body += .16 * np.sin(phase * 1.69) * np.exp(-t / .025)
    air = noise(t, 1150, 7900)
    crack = .9 * air * np.exp(-t / .043)
    claps = np.zeros_like(t)
    for delay, gain in ((.009, .22), (.017, .30), (.026, .21)):
        envelope = (t >= delay) * np.exp(-np.maximum(t - delay, 0) / .023)
        claps += gain * air * envelope
    snap = .22 * noise(t, 2300, 4200) * np.exp(-t / .014)
    mono = body + crack + claps + snap
    mono = oversampled_drive(mono, 1.6)
    room = filtered(noise(t, 550, 6700), 3800, "lowpass")
    room *= .29 * np.exp(-t / .054)
    sound = np.column_stack((mono + room, mono - room * .77))
    return normalize(filtered(sound, 120, "highpass"), .32) * edges(t)[:, None]


def hat(open_hat=False):
    t = time(.27 if open_hat else .095)
    raw = noise(t, 5200, 16500)
    metallic = np.zeros_like(t)
    for f in (3451, 5179, 6847, 8329, 10913):
        metallic += np.sign(np.sin(TAU * f * t)) * .036
    sound = filtered(raw + metallic, (6000, 16500), "bandpass")
    tail = .057 if open_hat else .012
    return normalize(sound * np.exp(-t / tail) * edges(t, .0006, .016), .21)


def metal(kind):
    t = time(.44 if kind == "rail" else .17)
    fundamental = 439 if kind == "rail" else 971
    out = np.zeros_like(t)
    for index, ratio in enumerate((1, 1.414, 2.618, 3.732, 6.27)):
        damping = (.057 if kind == "rail" else .016) / (1 + index * .28)
        out += np.sin(TAU * fundamental * ratio * t + .33 * index) * np.exp(-t / damping) / (1 + index)
    out += .28 * noise(t, 1100, 7000) * np.exp(-t / .011)
    out = filtered(oversampled_drive(out, 1.37), (510, 7300), "bandpass")
    return normalize(out * edges(t, .001, .025), .22)


def hook(note, duration, accent):
    t = time(duration + .12)
    f = pitch(note)
    cutoff = 1730 + 1540 * np.exp(-t / .09)
    channels = []
    for detune, phase_offset in ((.997, .35), (1.003, .7)):
        phase = TAU * f * t * detune + phase_offset
        core = periodic_wave(phase, cutoff, f)
        octave = periodic_wave(phase * 2 + .6, cutoff * 1.24, f * 2, pulse=True)
        upper = periodic_wave(phase * 1.5 + .4, cutoff, f * 1.5)
        sound = .77 * core + .24 * octave + .19 * upper
        sound = filtered(oversampled_drive(sound, 1.2), (390, 5700), "bandpass")
        channels.append(sound)
    envelope = edges(t, .006, .12) * (.46 + .54 * np.exp(-t / .14))
    sound = np.column_stack(channels) * envelope[:, None]
    return normalize(sound, .25) * accent


def texture(note, duration):
    t = time(duration)
    f = pitch(note)
    channels = []
    for detune in (.995, 1.005):
        phase = TAU * f * t * detune + .23 * np.sin(TAU * .39 * t)
        cutoff = 670 + 320 * np.sin(TAU * .18 * t) ** 2
        body = periodic_wave(phase, cutoff, f)
        body += .3 * periodic_wave(phase * 1.5 + .4, cutoff, 1.5 * f)
        channels.append(filtered(body, (390, 2300), "bandpass"))
    env = edges(t, .36, .5)
    return normalize(np.column_stack(channels) * env[:, None], .18)


def transition(duration):
    t = time(duration)
    rise = (t / t[-1]) ** 1.5
    channels = []
    for _ in range(2):
        air = noise(t, 1300, 5200)
        rail = np.sin(TAU * (429 * t + 109 * t * t))
        rail += .27 * np.sin(TAU * (777 * t + 186 * t * t))
        channels.append(.57 * air + .17 * rail)
    return normalize(np.column_stack(channels) * (rise * edges(t, .03, .028))[:, None], .22)


bass_patterns = (
    ((0, 42, 2.4, 1), (3, 42, .76, .69), (5.5, 49, 1.7, .87),
     (8, 45, 2.45, .87), (11, 42, 1.52, .96), (14, 40, 1.37, .77)),
    ((0, 42, 2.7, 1), (4, 54, 1.25, .72), (6, 49, 2.6, .92),
     (10, 47, 1.2, .78), (12, 45, 1.34, .84), (14.5, 40, .87, .72)),
    ((0, 38, 2.5, 1), (3.5, 45, 1.3, .76), (6, 49, 2.28, .91),
     (9, 50, 1.54, .83), (12, 49, 1.55, .90), (14.5, 40, .82, .75)),
    ((0, 40, 2.6, .97), (4, 47, 1.25, .79), (6, 52, 2.1, .9),
     (9, 49, 1.4, .77), (11, 47, 2.3, .85), (14, 40, 1.41, .78)),
)
hook_phrases = (
    ((0, 66, 2.45, .92), (3, 69, 1.3, .77), (6, 68, 2.35, .85),
     (10, 64, 1.55, .75), (13, 66, 2.10, .93)),
    ((2, 61, 2.55, .82), (6, 64, 1.75, .79), (9, 66, 4.8, .88)),
    ((0, 66, 2.35, .92), (3, 69, 1.3, .77), (6, 73, 2.3, .85),
     (10, 71, 1.53, .75), (13, 69, 2.1, .87)),
    ((2, 68, 2.4, .83), (6, 64, 1.8, .79), (9, 66, 4.9, .90)),
)
kick_patterns = (
    ((0, 1), (3, .74), (6, .92), (10, .85), (14, .88)),
    ((0, 1), (6, .92), (8, .82), (11, .86), (14.5, .70)),
    ((0, 1), (3.5, .76), (6, .89), (10, .87), (13, .82)),
    ((0, 1), (5, .83), (8, .92), (11, .79), (14, .86)),
)

kick_sample = kick()
snare_sample = snare()

for bar in range(BARS):
    reduced = 8 <= bar < 10
    accent = .87 if bar < 2 else .78 if reduced else 1
    for step, velocity in kick_patterns[bar % 4]:
        if reduced and step not in (0, 6):
            continue
        start = position(bar, step)
        kick_events.append(start)
        place("kick", start, kick_sample, velocity * accent)
    for step in (4, 12):
        if reduced and step == 4:
            continue
        place("snare", position(bar, step, .006), snare_sample, accent)
    if bar % 4 == 3 and not reduced:
        for step, velocity in ((13.5, .22), (15, .32)):
            place("snare", position(bar, step, .004), snare_sample, velocity)

    for step in ((2, 6, 10, 14) if reduced else range(0, 16, 2)):
        open_hat = step == 14 and bar % 2 == 1
        level = .88 if step % 4 == 2 else .53
        place("hats", position(bar, step, .009), hat(open_hat), level * accent,
              -.27 if step % 4 == 2 else .24)
    if bar % 2 == 1 and not reduced:
        for step in (7, 15):
            place("hats", position(bar, step, .012), hat(), .36, .42)

    pattern = bass_patterns[bar % 4]
    for step, note, duration, velocity in pattern:
        if reduced and step in (3, 3.5, 5.5, 10, 11, 12, 14, 14.5):
            continue
        mid, sub = bass_note(note, duration * STEP / RATE, velocity)
        start = position(bar, step, .001)
        place("bass", start, mid, velocity * accent)
        place("sub", start, sub, velocity * accent)

    if not reduced:
        for step, kind, velocity, pan in (
            (2.75, "tick", .48, -.48), (7.5, "rail", .79, .47),
            (10.75, "tick", .52, .4), (15.25, "rail", .62, -.32),
        ):
            place("metal", position(bar, step), metal(kind), velocity)

    if bar in (4, 5, 6, 7, 10, 11, 12, 13, 14, 15):
        phrase = hook_phrases[(bar - (4 if bar < 8 else 10)) % 4]
        for step, note, duration, velocity in phrase:
            place("hook", position(bar, step, .008),
                  hook(note, duration * STEP / RATE, velocity), .9 if bar < 8 else 1)

    if bar in (0, 4, 8, 10, 12, 14):
        root = (54, 54, 50, 54, 50, 52)[(0, 4, 8, 10, 12, 14).index(bar)]
        place("texture", position(bar, 0), texture(root, 4.4), .7 if reduced else .45)
    if bar in (3, 7, 9, 13, 15):
        place("texture", position(bar, 8), transition(1.17), .62 if bar == 9 else .41)


def delay(name, taps, low, high):
    dry = filtered(tracks[name], (low, high), "bandpass").copy()
    for beats, level, cross in taps:
        shift = round(beats * BEAT)
        source = dry[:, ::-1] if cross else dry
        tracks[name][shift:] += source[:-shift] * level


delay("snare", ((.037, .11, True), (.069, .07, False), (.117, .045, True)), 700, 5800)
delay("metal", ((.17, .19, True), (.41, .13, False), (.73, .07, True)), 850, 5100)
delay("hook", ((.75, .19, True), (1.5, .085, False), (2.25, .044, True)), 780, 3900)
delay("texture", ((.27, .23, True), (.53, .14, False)), 440, 3600)

# Establish the balance explicitly. Low bass and high-mid definition have their own faders.
targets = {
    "kick": .073, "snare": .065, "hats": .023, "metal": .022,
    "bass": .091, "sub": .039, "hook": .052, "texture": .019,
}
for name, track in tracks.items():
    track[:] = normalize(track, targets[name])
    if name in ("bass", "hook", "texture"):
        attack = round(.003 * RATE)
        tail = time(.21)
        envelope = 1 - .31 * np.minimum(1, tail / .003) * np.exp(-tail / .054)
        envelope[-round(.027 * RATE):] = np.linspace(envelope[-round(.027 * RATE)], 1, round(.027 * RATE))
        duck = np.ones(LENGTH, dtype=np.float32)
        for start in kick_events:
            count = min(len(envelope), LENGTH - start)
            np.minimum(duck[start:start + count], envelope[:count], out=duck[start:start + count])
        track *= duck[:, None]

mix = sum(tracks.values())
mix = filtered(mix, 27, "highpass", order=2)
mix -= mix.mean(axis=0)

# Gentle high-mid presence restores definition on small speakers.
presence = filtered(mix, (950, 3200), "bandpass")
mix += .21 * presence
block = 240
padding = (-LENGTH) % block
working = np.pad(mix, ((0, padding), (0, 0)))
peaks = np.max(np.abs(working.reshape(-1, block, 2)), axis=(1, 2))
detector = ndimage.maximum_filter1d(peaks, size=9, mode="nearest")
gains = np.minimum(1, (.58 / np.maximum(detector, .58)) ** .72)
gains = ndimage.gaussian_filter1d(gains, 2.2)
gain_curve = np.interp(np.arange(LENGTH), np.arange(len(gains)) * block, gains)
mix *= gain_curve[:, None]
mix *= .86 / np.max(np.abs(mix))
mix[:round(.004 * RATE)] *= np.linspace(0, 1, round(.004 * RATE))[:, None]
mix[-round(.6 * RATE):] *= np.linspace(1, 0, round(.6 * RATE))[:, None]


def export(filename, codec):
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "f32le", "-ar", str(RATE), "-ac", "2", "-i", "pipe:0",
        "-metadata", "title=Second Body - V2 Sound Sketch",
        *codec, str(OUTPUT / filename),
    ]
    subprocess.run(command, input=mix.astype("<f4").tobytes(), check=True)


export("second-body-v2-sketch.wav", ("-c:a", "pcm_s24le"))
export("second-body-v2-sketch.mp3", ("-c:a", "libmp3lame", "-q:a", "0"))
print("Rendered", LENGTH / RATE, "seconds at", TEMPO, "BPM", flush=True)
print("Peak", np.max(np.abs(mix)), "RMS", np.sqrt(np.mean(mix ** 2)), flush=True)
frequencies, power = signal.welch(mix.mean(axis=1), RATE, nperseg=8192)
for low, high in ((25, 65), (65, 110), (110, 280), (280, 800), (800, 2500), (2500, 7500)):
    mask = (frequencies >= low) & (frequencies < high)
    print(low, high, round(100 * sum(power[mask]) / sum(power), 1))
