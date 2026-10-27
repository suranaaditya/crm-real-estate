"""Narration: one mp3 per beat, with WORD timings (for pinning on-screen actions to words) and a
sentence-level SRT built from them (for captions). Same synthesis pass, so they always agree."""
import asyncio, json, re, subprocess, pathlib
import edge_tts
from beats import BEATS
HERE = pathlib.Path(__file__).parent
OUT = HERE / "audio"; OUT.mkdir(exist_ok=True)
VOICE, RATE = "en-IN-NeerjaNeural", "-3%"
TOK = re.compile(r"[\w']+")


def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def sentences_srt(text, words):
    """Group the word boundaries back into the text's sentences."""
    sents = [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]
    out, i = [], 0
    for n, s in enumerate(sents):
        k = len(TOK.findall(s))
        chunk = words[i:i + k] if n < len(sents) - 1 else words[i:]
        i += k
        if chunk:
            out.append(f"{len(out) + 1}\n{ts(chunk[0]['start'])} --> {ts(chunk[-1]['end'])}\n{s}\n")
    return "\n".join(out)


async def one(key, text):
    mp3, wj, srt, txt = (OUT / f"{key}.{e}" for e in ("mp3", "words.json", "srt", "txt"))
    if all(p.exists() for p in (mp3, wj, srt, txt)) and txt.read_text() == text:
        return
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    words = []
    with open(mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                st = chunk["offset"] / 1e7
                words.append({"w": chunk["text"], "start": round(st, 3), "end": round(st + chunk["duration"] / 1e7, 3)})
    wj.write_text(json.dumps(words))
    srt.write_text(sentences_srt(text, words))
    txt.write_text(text)


def dur(p):
    o = subprocess.run([str(HERE / "ffmpeg"), "-hide_banner", "-i", str(p)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", o).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


async def main():
    for i in range(0, len(BEATS), 6):
        await asyncio.gather(*(one(k, t) for k, t in BEATS[i:i + 6]))
    durs = {k: round(dur(OUT / f"{k}.mp3"), 2) for k, _ in BEATS}
    (HERE / "durations.json").write_text(json.dumps(durs, indent=1))
    bad = []
    for k, t in BEATS:
        w = json.loads((OUT / f"{k}.words.json").read_text())
        if len(w) != len(TOK.findall(t)) or w[-1]["end"] > durs[k] + 0.05:
            bad.append((k, len(w), len(TOK.findall(t))))
    print("total narration: %.1f min" % (sum(durs.values()) / 60), "beats:", len(durs), "word-count mismatches:", bad)
asyncio.run(main())
