from pathlib import Path
import subprocess
import tempfile
import zipfile

import numpy as np
from scipy import ndimage, signal


RATE = 48_000
TEMPO = 96
BARS = 56
BEAT = RATE * 60 // TEMPO
STEP = BEAT // 4
LENGTH = BARS * 16 * STEP
TAU = 2 * np.pi
rng = np.random.default_rng(417026)
output = Path(__file__).resolve().parent / "renders"
output.mkdir(exist_ok=True)
temporary_stems = tempfile.TemporaryDirectory(prefix="second-body-")
work = Path(temporary_stems.name)
stems = {
    name: np.zeros((LENGTH, 2), dtype=np.float32)
    for name in ("Drums", "Bass", "Metal", "Motif", "Atmosphere")
}
kick_starts = []


def seconds(duration):
    return np.arange(round(duration * RATE), dtype=np.float64) / RATE


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def decay(t, half_life):
    return np.exp2(-t / half_life)


def fades(t, attack=.003, release=.018):
    return np.minimum(1, t / attack) * np.minimum(1, (t[-1] - t) / release)


def eq(x, frequency, kind, order=2):
    return signal.sosfilt(
        signal.butter(order, frequency, btype=kind, fs=RATE, output="sos"), x,
        axis=0,
    )


def band_noise(t, low, high):
    source = rng.standard_normal(t.size)
    return eq(source, (low, high), "bandpass")


def stereo(left, right):
    return np.stack((left, right), axis=-1)


def place(name, start, sound, level=1, pan=0):
    start = round(start) % LENGTH
    gains = np.sqrt(1 + np.array([-pan, pan])) * level
    frame = np.asarray(sound, dtype=np.float32)
    if frame.ndim == 1:
        frame = frame[:, None]
    end = min(LENGTH - start, len(frame))
    stems[name][start:start + end] += frame[:end] * gains
    if end < len(frame):
        stems[name][:len(frame) - end] += frame[end:] * gains


def onset(bar, step, offset=0):
    return round((bar * 16 + step) * STEP + offset * RATE)


def kick(velocity):
    t = seconds(.35)
    phase = TAU * (47 * t + 81 * .018 * (1 - np.exp(-t / .018)))
    body = np.sin(phase) * decay(t, .089)
    knock = np.sin(2 * phase + .04) * .24 * decay(t, .031)
    edge = band_noise(t, 1450, 5700) * .13 * decay(t, .0048)
    out = np.tanh((body + knock + edge) * 1.23) * fades(t, .0012, .066)
    return out * velocity


def snare(velocity):
    t = seconds(.38)
    phase = TAU * (168 * t + 38 * .014 * (1 - np.exp(-t / .014)))
    body = (.42 * np.sin(phase) + .15 * np.sin(1.49 * phase)) * decay(t, .031)
    gate = (.8 * decay(t, .034))
    for delay in (.008, .016, .023):
        gate += .16 * (t >= delay) * decay(np.maximum(t - delay, 0), .014)
    center = body + .84 * band_noise(t, 740, 6800) * gate
    skirt = .23 * band_noise(t, 1000, 7200) * decay(t, .057)
    air = .057 * band_noise(t, 2300, 9300) * decay(t, .083)
    return stereo(center + skirt, center + air - .51 * skirt) * (
        velocity * fades(t, .0018, .042))[:, None]


def hat(is_open, flavor):
    t = seconds(.32 if is_open else .119)
    noise = band_noise(t, 4700, 12_300)
    clang = np.sin(TAU * 5245 * t + .94 * np.sin(TAU * 3017 * t))
    bright = eq(clang, 5200, "highpass")
    envelope = decay(t, (.073 if is_open else .018) * flavor)
    return (noise * .77 + bright * .14) * envelope * fades(t, .0014, .028)


def metal_hit(kind):
    duration = {"rail": .72, "pipe": .35, "impact": 1.1, "click": .21}[kind]
    t = seconds(duration)
    tonal = np.zeros_like(t)
    profiles = {
        "rail": (359, .11, (1, 1.53, 2.37, 4.21, 5.73), 920),
        "pipe": (573, .048, (1, 1.42, 2.81, 3.36, 6.04), 1230),
        "impact": (153, .18, (1, 1.86, 2.74, 3.53, 7.08), 590),
        "click": (713, .022, (1, 2.07, 2.88, 4.31, 5.38), 1440),
    }
    fundamental, resonant_tail, overtones, noise_low = profiles[kind]
    for i, ratio in enumerate(overtones):
        f = ratio * fundamental * rng.uniform(.981, 1.019)
        phase = TAU * (f * t + .9 * (1 - decay(t, .009)))
        tonal += np.sin(phase) * decay(t, resonant_tail / (1 + i * .32)) / (1 + i * .52)
    transient = band_noise(t, noise_low, 6800) * decay(t, .024) * .64
    out = eq(np.tanh(tonal + transient), 136, "highpass")
    return out * fades(t, .0017, .075 if kind == "impact" else .030)


def bass(note, length, accent, motion):
    t = seconds(length + .064)
    f = hz(note)
    phase = TAU * (f * t - .022 * f * (1 - np.exp(-t / .027)) * motion)
    sub = .82 * np.sin(.5 * phase) + .30 * np.sin(phase + .13)
    nose = np.zeros_like(t)
    cutoff = 390 + accent * 1120 * decay(t, .098) + 115 * np.sin(TAU * .72 * t)
    for harmonic in range(1, 16):
        h = harmonic * phase
        weight = 1 / (harmonic ** .91 * np.sqrt(1 + (f * harmonic / cutoff) ** 6))
        pair = .62 * np.sin(h) + .25 * np.sin(h * 1.0042 + harmonic * .20)
        pair += .19 * np.sin(h * .9963 + harmonic * .51)
        nose += pair * weight
    grit = np.tanh(2.5 * nose + .19 * nose * nose)
    grit = eq(eq(grit, 117, "highpass"), 2650, "lowpass")
    tip = .13 * np.sin(TAU * (2.09 * f) * t + .6 * np.sin(phase * 1.5)) * decay(t, .034)
    body = (.65 * sub + .61 * grit + tip)
    body *= (.74 + .26 * decay(t, .115)) * fades(t, .0085, .063)
    return body


def motif(note, length, open_tone):
    t = seconds(length + .21)
    f = hz(note)
    vibrato = .0028 * np.sin(TAU * 4.8 * t) * np.minimum(1, 2.2 * t)
    phase = TAU * (f * t + .009 * f * (1 - decay(t, .019))) + vibrato * f
    mouth = (.42 + .50 * open_tone) * decay(t, .22) + .38
    core = np.sin(phase + mouth * np.sin(phase * 2.006 + .5))
    reed = np.sin(phase * 1.005 + .8 * np.sin(phase * .501))
    high = np.sin(2 * phase + .33) * decay(t, .137)
    asymmetric = eq(np.tanh(1.3 * core + .29 * reed), (177, 2750), "bandpass")
    flutter = .93 + .07 * np.sin(TAU * 3.11 * t + .4)
    env = fades(t, .021, .188) * (.55 + .45 * decay(t, .22)) * flutter
    centered = (.80 * asymmetric + .14 * high) * env
    haze_l = eq(np.sin(phase * .996 + .4), (290, 1970), "bandpass")
    haze_r = eq(np.sin(phase * 1.006 - .3), (290, 1970), "bandpass")
    return stereo(centered + .15 * haze_l * env, centered + .15 * haze_r * env)


def pad(note, duration, shade):
    t = seconds(duration)
    f = hz(note)
    swell = np.sin(np.minimum(t / .53, 1) * np.pi / 2) ** 2
    tail = np.sin(np.minimum((t[-1] - t) / 1.15, 1) * np.pi / 2) ** 2
    lfo = .75 + .25 * np.sin(TAU * .27 * t + note)
    channels = []
    for detune in (.996, 1.004):
        phase = TAU * f * t * detune + .24 * np.sin(TAU * .19 * t + shade)
        x = .61 * np.sin(phase) + .27 * np.sin(2 * phase + shade)
        x += .29 * np.sin(phase * .999 + .46 * np.sin(TAU * .31 * t))
        x += .17 * lfo * np.sin(3 * phase + .65 * np.sin(phase))
        x += .073 * lfo * np.sin(5 * phase + .3)
        channels.append(eq(x, (122, 1110 + 210 * shade), "bandpass"))
    return stereo(*channels) * (swell * tail * lfo)[:, None]


def transition(duration, seed_note):
    t = seconds(duration)
    f = hz(seed_note)
    rise = (t / t[-1]) ** 1.7
    sweep = TAU * (f * t + 94 * t ** 2 / duration)
    emphasis = .22 * np.sin(sweep + .83 * rise * np.sin(2.327 * sweep))
    left = emphasis + .26 * band_noise(t, 960, 5100) + .16 * band_noise(t, 302, 865)
    right = .88 * emphasis + .26 * band_noise(t, 1020, 5800) + .18 * band_noise(t, 314, 917)
    return stereo(left, right) * (rise * fades(t, .24, .082))[:, None]


# Pitches are MIDI numbers. A quieter octave answers the low three-note pickup.
riff_a = [(0, 38, 2.55, 1), (3, 38, 1.13, .70), (6, 45, 1.85, .87),
          (9, 41, 1.4, .76), (11, 38, 2.8, .97), (15, 36, .62, .59)]
riff_b = [(0, 38, 2.25, .93), (3, 38, 1.41, .74), (6, 48, 1.57, .82),
          (8, 45, 2.2, .89), (11, 43, 1.36, .74), (14, 41, 1.38, .87)]
riff_c = [(0, 34, 2.75, .98), (4, 41, 1.26, .7), (6, 45, 2.30, .84),
          (10, 48, 1.36, .74), (12, 45, 1.57, .88), (15, 36, .62, .61)]
riff_d = [(0, 31, 2.38, 1), (3, 43, 1.92, .78), (7, 46, 1.05, .7),
          (9, 45, 1.62, .84), (11, 41, 2.27, .86), (15, 36, .65, .61)]
riff_e = [(0, 36, 2.6, .96), (4, 43, 1.26, .79), (6, 50, 1.47, .81),
          (9, 48, 1.55, .72), (11, 45, 2.08, .93), (14, 36, 1.31, .64)]
riff_f = [(0, 38, 4.7, .92), (6, 45, 2.0, .79), (11, 41, 2.8, .82)]
riff_g = [(0, 34, 4.5, .87), (6, 45, 1.95, .77), (11, 48, 2.80, .75)]
riff_h = [(0, 31, 3.9, .88), (6, 43, 2.07, .78), (11, 45, 2.37, .83)]
riff_i = [(0, 36, 4.0, .9), (6, 43, 1.9, .77), (11, 50, 1.8, .8),
          (15, 36, .62, .61)]
riff_j = [(0, 38, 2.24, 1), (3, 50, 1.28, .70), (6, 45, 1.9, .87),
          (9, 41, 1.4, .76), (11, 38, 2.8, .97), (14, 43, 1.54, .77)]
riff_end = [(0, 36, 2.7, .87), (4, 43, 1.65, .76), (7, 41, 1.46, .71),
            (10, 45, 1.42, .7), (13, 36, 2.22, .69)]
bass_score = [
    riff_a, riff_b, riff_a, riff_b, riff_a, riff_b, riff_c, riff_e,
    riff_a, riff_b, riff_c, riff_c, riff_d, riff_d, riff_e, riff_e,
    riff_j, riff_b, riff_j, riff_b, riff_c, riff_d, riff_e, riff_e,
    riff_f, riff_f, riff_g, riff_g, riff_h, riff_h, riff_i, riff_i,
    riff_a, riff_b, riff_c, riff_c, riff_d, riff_d, riff_e, riff_e,
    riff_j, riff_b, riff_j, riff_b, riff_c, riff_c, riff_d, riff_e,
    riff_a, riff_b, riff_c, riff_d, riff_e, riff_c, riff_a, riff_end,
]

phrase_a = {
    0: [(6, 65, 2.12, .78), (9, 64, 1.50, .64), (11, 60, 3.6, .71)],
    1: [(3, 57, 2.35, .61), (8, 60, 1.3, .54), (11, 62, 3.1, .76)],
    2: [(6, 65, 2.1, .79), (9, 64, 1.48, .67), (11, 67, 3.5, .78)],
    3: [(4, 64, 1.9, .65), (8, 62, 4.11, .73)],
}
phrase_b = {
    0: [(6, 65, 2.1, .84), (9, 64, 1.4, .76), (11, 60, 3, .87)],
    1: [(3, 57, 2.2, .71), (7, 60, 1.5, .64), (11, 62, 3.35, .79)],
    2: [(6, 65, 2.1, .86), (9, 64, 1.42, .74), (11, 69, 3.63, .84)],
    3: [(3, 67, 1.93, .77), (7, 64, 2.25, .73), (11, 62, 3.62, .82)],
}
phrase_c = {
    0: [(1, 65, 4.88, .61), (7, 64, 2.25, .58), (11, 60, 3.82, .68)],
    1: [(6, 57, 3.7, .59), (12, 62, 2.96, .65)],
    2: [(1, 67, 4.25, .68), (7, 65, 2.55, .57), (11, 62, 3.36, .62)],
    3: [(5, 64, 3.13, .64), (10, 62, 4.37, .67)],
}
chords = {
    "Dm": (53, 57, 62, 64), "Bb": (53, 57, 60, 62),
    "Gm": (55, 58, 62, 65), "C": (52, 55, 62, 69),
}
chord_score = (
    "Dm Dm Dm Dm Dm Dm Bb C "
    "Dm Dm Bb Bb Gm Gm C C "
    "Dm Dm Dm Dm Bb Gm C C "
    "Dm Dm Bb Bb Gm Gm C C "
    "Dm Dm Bb Bb Gm Gm C C "
    "Dm Dm Dm Dm Bb Bb Gm C "
    "Dm Dm Bb Gm C Bb Dm C"
).split()

kicks = (
    ((0, 1), (6, .87), (10, .83), (13, .74)),
    ((0, 1), (3, .73), (7, .86), (10, .84), (14, .86)),
    ((0, 1), (6, .84), (9, .82), (11, .69), (14, .86)),
    ((0, 1), (5, .81), (8, .86), (13, .81)),
)
for bar in range(BARS):
    quiet = 24 <= bar < 32
    landing = 40 <= bar < 48
    first = bar < 4
    drive = (.76 if quiet else .91 if first else 1.06 if landing else 1)
    if bar in (31, 39, 55):
        drum_pattern = ((0, 1), (6, .85), (10, .84))
    elif quiet:
        drum_pattern = ((0, 1), (6, .78), (11, .81))
    else:
        drum_pattern = kicks[bar % len(kicks)]
    for step, velocity in drum_pattern:
        start = onset(bar, step)
        kick_starts.append((start, velocity * drive))
        place("Drums", start, kick(velocity), .43 * drive)
    for step in (4, 12):
        snare_level = .53 if quiet and step == 4 else .83 if quiet else 1
        place("Drums", onset(bar, step, .010), snare(snare_level), .230 * drive)
    if bar % 4 == 1 and not quiet:
        place("Drums", onset(bar, 15, .008), snare(.24), .149)
    if bar in (7, 15, 23, 38, 47, 54):
        for i, step in enumerate((10.5, 13.5, 14.5, 15.1)):
            place("Drums", onset(bar, step), snare(.20 + .08 * i), .125, .15 - .11 * i)

    hat_pattern = (2, 6, 10, 14) if quiet else (0, 2, 4, 6, 8, 10, 12, 14)
    if bar % 4 == 3 or landing:
        hat_pattern += (7, 11, 15)
    for step in hat_pattern:
        is_open = step in (6, 14) and (bar % 2 == 0 or landing)
        offset = .015 if step % 2 else .003
        if step != 0:
            offset += rng.uniform(-.003, .003)
        accents = {2: 1.0, 6: .91, 10: 1.0, 14: .96}
        pan = -.22 if step % 4 == 2 else .24
        place("Drums", onset(bar, step, offset), hat(is_open, rng.uniform(.88, 1.12)),
              .101 * drive * accents.get(step, .51), pan)

    for step, note, duration, velocity in bass_score[bar]:
        place("Bass", onset(bar, step, .003), bass(note, duration * STEP / RATE,
              velocity * (.57 if quiet else 1), .29 if step == 0 else .83),
              .346 * velocity * (.84 if quiet else 1.04 if landing else 1))
    for step, kind, velocity, pan in (
        (2.5, "click", .40, -.42), (5.5, "pipe", .70, .48),
        (10.75, "click", .51, .51), (13.5, "rail", .69, -.52),
    ):
        if step in (2.5, 10.75) and (first or quiet):
            continue
        place("Metal", onset(bar, step, .007), metal_hit(kind), .121 * velocity * drive, pan)
    if bar in (3, 7, 15, 23, 31, 35, 39, 43, 47, 51, 55):
        place("Metal", onset(bar, 15.25), metal_hit("impact"), .085, -.26)
    if bar in (8, 16, 32, 40, 48):
        place("Metal", onset(bar, 0), metal_hit("impact"), .14, .11)
    if landing:
        place("Metal", onset(bar, 7.5), metal_hit("pipe"), .066, -.34)

    lead = []
    if bar < 8:
        lead = phrase_a[bar % 4] if bar >= 2 else [(11, 62, 2.4, .43)] if bar == 1 else []
    elif 8 <= bar < 16 and bar % 4 in (1, 3):
        lead = phrase_c[bar % 4]
    elif 16 <= bar < 24:
        lead = phrase_b[bar % 4]
    elif quiet and bar % 2 == 1:
        lead = {25: [(7, 57, 4, .43)], 27: [(9, 60, 4.4, .44)],
                29: [(6, 62, 4.8, .48)], 31: [(8, 64, 3.9, .49)]}[bar]
    elif 32 <= bar < 40:
        lead = phrase_c[bar % 4]
    elif landing:
        lead = phrase_b[bar % 4]
    elif 48 <= bar < 54:
        lead = phrase_a[bar % 4]
    elif bar == 55:
        lead = [(6, 60, 2.8, .46), (11, 57, 2.0, .42)]
    for step, note, duration, velocity in lead:
        strength = 1.12 if landing else .72 if quiet else 1
        place("Motif", onset(bar, step, .012),
              motif(note, duration * STEP / RATE, velocity), .113 * strength * velocity, -.085)
        if landing and step >= 9 and bar % 2 == 0:
            place("Motif", onset(bar, step, .027), motif(note - 12, duration * STEP / RATE, .44),
                  .029, .22)

    if bar == 0 or chord_score[bar] != chord_score[bar - 1] or bar % 2 == 0:
        chord = chords[chord_score[bar]]
        hold = 2 if bar % 2 == 0 and bar + 1 < BARS and chord_score[bar + 1] == chord_score[bar] else 1
        pad_gain = .057 if quiet else .043 if landing else .034 if first else .047
        for i, pitch in enumerate(chord):
            place("Atmosphere", onset(bar, -.25), pad(pitch, 2.5 * hold + .77, i * .49),
                  pad_gain * (1 - i * .12), (i - 1.5) * .27)
    if bar in (3, 7, 11, 15, 19, 23, 31, 35, 39, 43, 47, 51, 55):
        place("Atmosphere", onset(bar, 4.5), transition(1.82, (38, 41, 43, 45)[bar // 4 % 4]),
              .23 if bar in (15, 39, 47) else .15, .16 if bar % 8 == 3 else -.13)


def echo(name, delays, frequency):
    stem = stems[name]
    dry = eq(stem[::-1], frequency, "lowpass")[::-1].astype(np.float32)
    # The echoes wrap around the arrangement, including the last bar.
    for delay, gain, cross in delays:
        offset = round(delay * BEAT)
        source = dry[:, ::-1] if cross else dry
        stem[offset:] += source[:-offset] * gain
        stem[:offset] += source[-offset:] * gain


echo("Drums", ((.079, .071, True), (.146, .044, False), (.233, .027, True)), 2900)
echo("Metal", ((.142, .18, True), (.381, .12, False), (.747, .066, True)), 3300)
echo("Motif", ((.75, .235, True), (1.5, .124, False), (2.25, .07, True),
               (3, .037, False)), 2100)

sidechain = np.ones(LENGTH, dtype=np.float32)
t = seconds(.23)
for start, velocity in kick_starts:
    duck = 1 - .42 * velocity * np.minimum(t / .007, 1) * decay(t, .070)
    duck = 1 - (1 - duck) * fades(t, .003, .032)
    count = min(LENGTH - start, len(duck))
    np.minimum(sidechain[start:start + count], duck[:count], out=sidechain[start:start + count])
    if count < len(duck):
        end = len(duck) - count
        np.minimum(sidechain[:end], duck[count:], out=sidechain[:end])
stems["Bass"] *= sidechain[:, None]
stems["Atmosphere"] *= .73 + .27 * sidechain[:, None]

# Circular de-mean preserves an uninterrupted seam and removes any DC bias.
for name, track in stems.items():
    track -= track.mean(axis=0, dtype=np.float64)
    print(name, "RMS", float(np.sqrt(np.mean(track ** 2))), "peak", float(np.max(np.abs(track))), flush=True)
mix = sum(stems.values())
block = 240
block_peaks = np.max(np.abs(mix.reshape(-1, block, 2)), axis=(1, 2))
short_peaks = ndimage.maximum_filter1d(block_peaks, size=9, mode="wrap")
gain = np.minimum(1, (.63 / np.maximum(short_peaks, .63)) ** .52)
gain = ndimage.gaussian_filter1d(gain, sigma=3., mode="wrap")
points = np.arange(len(gain) + 1) * block
smooth_gain = np.interp(np.arange(LENGTH), points, np.r_[gain, gain[0]]).astype(np.float32)
mix *= smooth_gain[:, None]
normalization = .868 / np.max(np.abs(mix))
mix *= normalization
print("Peak", np.max(np.abs(mix)), "RMS", np.sqrt(np.mean(mix ** 2)), "gain", normalization, flush=True)


def write_pcm(path, pcm, options, title):
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le",
        "-ar", str(RATE), "-ac", "2", "-i", "pipe:0", "-metadata", f"title={title}",
        *options, str(path),
    ]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
        for start in range(0, LENGTH, RATE):
            process.stdin.write(pcm[start:start + RATE].astype("<f4", copy=False).tobytes())
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError(f"FFmpeg failed to write {path}")


write_pcm(output / "Second Body - Gameplay Loop.wav", mix, ["-c:a", "pcm_s24le"],
          "Second Body (Gameplay Loop)")
write_pcm(output / "Second Body - Preview.mp3", mix, ["-c:a", "libmp3lame", "-q:a", "1"], "Second Body")

with zipfile.ZipFile(output / "Second Body - Stems.zip", "w", compression=zipfile.ZIP_STORED) as archive:
    for name, track in stems.items():
        track *= smooth_gain[:, None]
        track *= normalization
        path = work / f"Second Body - {name}.flac"
        write_pcm(path, track, ["-c:a", "flac", "-sample_fmt", "s16", "-compression_level", "8"],
                  f"Second Body - {name}")
        archive.write(path, path.name)

print("Master seam samples:", mix[-2:].tolist(), mix[:2].tolist(), flush=True)
