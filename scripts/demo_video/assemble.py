"""Lays the narration on the recorded walkthrough, burns in captions, writes the final MP4.

- `cuts` from timings.json (page loads, the AI wait) are removed from the video; every later
  beat's audio and captions shift left by the time removed before it.
- Each beat's mp3 is placed at its (shifted) logged start.
- Captions come from the per-beat word timings: one cue per sentence, long sentences split at
  commas, so no caption runs past two lines.
- VP8 keyframes in Playwright's recording are visibly softer (a pulse every ~5 s); they are
  dropped before the fps filter, which repeats the previous clean frame in their place.
"""
import json, re, subprocess, sys
from common import HERE
from beats import BEATS

FF = str(HERE / "ffmpeg")
REC = HERE / (sys.argv[2] if len(sys.argv) > 2 else "rec_out")
T = json.loads((REC / "timings.json").read_text())
DUR = json.loads((HERE / "durations.json").read_text())
TEXT = dict(BEATS)
OUT = HERE / "final"; OUT.mkdir(exist_ok=True)
HEAD = 1.0            # first frames are the intro card still loading — freeze the card over them
NAME = sys.argv[1] if len(sys.argv) > 1 else "Shradha Realty CRM - Complete Walkthrough.mp4"
TOK = re.compile(r"[\w']+")
MAXC = 84

FIX = [(r"\bC R M\b", "CRM"), (r"\bI D\b", "ID"), (r"\bA I\b", "AI"), (r"\bC S V\b", "CSV"),
       (r"\btwo B H K\b", "2 BHK"), (r"\bforty five lakh\b", "45 lakh"), (r"\bone point two crore\b", "1.2 crore")]


def clean(t):
    for a, b in FIX:
        t = re.sub(a, b, t)
    return t


def ts(x):
    ms = int(round(max(0, x) * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


cuts = sorted(T.get("cuts") or [])


def shift(t):
    """Original recording time -> time in the cut-down video."""
    gone = 0.0
    for a, z in cuts:
        if t >= z:
            gone += z - a
        elif t > a:
            gone += t - a
    return t - gone


def chunks(sentence):
    parts = re.split(r"(?<=[,:;])\s+", sentence)
    out, cur = [], ""
    for prt in parts:
        if cur and len(clean(cur + " " + prt)) > MAXC:
            out.append(cur); cur = prt
        else:
            cur = (cur + " " + prt).strip()
    if cur:
        out.append(cur)
    # a comma-free run that is still too long would wrap to two lines (two overlapping caption boxes):
    # split it at the word nearest its middle
    res = []
    for ch in out:
        stack = [ch]
        while stack:
            c = stack.pop(0)
            if len(clean(c)) <= MAXC or " " not in c:
                res.append(c); continue
            ws = c.split(" "); mid = len(c) / 2; acc, cut = 0, 1
            for j, w in enumerate(ws[:-1]):
                acc += len(w) + 1
                if acc >= mid:
                    cut = j + 1; break
            stack[:0] = [" ".join(ws[:cut]), " ".join(ws[cut:])]
    return res


beats = [dict(b, at=shift(b["start"])) for b in T["beats"]]
cues = []
for b in beats:
    words = json.loads((HERE / "audio" / f"{b['key']}.words.json").read_text())
    i = 0
    for sent in [s for s in re.split(r"(?<=[.!?])\s+", TEXT[b["key"]].strip()) if s]:
        for ch in chunks(sent):
            k = len(TOK.findall(ch)); ws = words[i:i + k]; i += k
            if ws:
                cues.append([b["at"] + ws[0]["start"], b["at"] + ws[-1]["end"], clean(ch)])
cues.sort()
for j in range(len(cues) - 1):               # hold a caption across short pauses; never overlap the next
    nxt = cues[j + 1][0]
    cues[j][1] = nxt - 0.04 if nxt - cues[j][1] < 0.7 else min(cues[j][1] + 0.3, nxt - 0.04)
cues[-1][1] += 0.4
(OUT / "captions.srt").write_text("\n".join(f"{n + 1}\n{ts(a)} --> {ts(z)}\n{t}\n" for n, (a, z, t) in enumerate(cues)))

rec_end = T["beats"][-1]["start"] + DUR[T["beats"][-1]["key"]] + 1.6
end = shift(rec_end)
keep, s0 = [], 0.0
for a, z in cuts:
    if a > s0:
        keep.append((s0, a))
    s0 = max(s0, z)
keep.append((s0, rec_end))

inputs = ["-i", T["video"]]
for b in beats:
    inputs += ["-i", str(HERE / "audio" / f"{b['key']}.mp3")]
parts = []
for i, b in enumerate(beats, start=1):
    ms = int(round(b["at"] * 1000))
    parts.append(f"[{i}:a]aresample=48000,adelay={ms}|{ms}[a{i}]")
mix = "".join(f"[a{i}]" for i in range(1, len(beats) + 1))
style = ("FontName=Arial,FontSize=10.5,PrimaryColour=&H00FFFFFF,OutlineColour=&H8C2E1A0F,BackColour=&H8C2E1A0F,"
         "BorderStyle=3,Outline=5,Shadow=0,MarginV=14,MarginL=60,MarginR=60,Bold=0")
srt_path = str(OUT / "captions.srt").replace(":", r"\:").replace("'", r"\'")
fc = ";".join(parts) + f";{mix}amix=inputs={len(beats)}:normalize=0:dropout_transition=0,"
fc += f"apad,atrim=0:{end:.3f},loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.4,afade=t=out:st={end - 1.4:.3f}:d=1.4[aout];"
fc += f"[0:v]select='not(eq(pict_type\\,I))',fps=30,split={len(keep)}" + "".join(f"[k{i}]" for i in range(len(keep))) + ";"
for i, (a, z) in enumerate(keep):
    fc += f"[k{i}]trim=start={a:.3f}:end={z:.3f},setpts=PTS-STARTPTS[c{i}];"
fc += "".join(f"[c{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=1:a=0[cat];"
fc += (f"[cat]trim=start={HEAD},setpts=PTS-STARTPTS,tpad=start={int(round(HEAD * 30))}:start_mode=clone,setpts=N/30/TB,"   # clones reuse the first pts: renumber
       f"trim=0:{end:.3f},setpts=PTS-STARTPTS,"
       f"subtitles=filename='{srt_path}':force_style='{style}',"
       f"fade=t=in:d=0.5,fade=t=out:st={end - 1.4:.3f}:d=1.4,format=yuv420p[vout]")
cmd = [FF, "-hide_banner", "-y", *inputs, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-r", "30",
       "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart",
       str(OUT / NAME)]
print("cuts %s | keep %d segments | final %.1fs (%.1f min) | %d beats, %d cues"
      % ([round(z - a, 1) for a, z in cuts], len(keep), end, end / 60, len(beats), len(cues)))
(OUT / "beat_times.json").write_text(json.dumps([{"key": b["key"], "at": round(b["at"], 2)} for b in beats], indent=1))
r = subprocess.run(cmd, capture_output=True, text=True)
print(r.stderr[-1500:])
print("exit", r.returncode)
