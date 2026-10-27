# Narrated walkthrough video

Records the client training video ("Shradha Realty CRM – Complete Walkthrough", ~15 min) from the
LIVE app: a headless browser drives the CRM while an Indian-English TTS narration is laid on top.
Every on-screen action is pinned to a spoken word, so the screen and the voice stay in step.

| File | What it does |
|---|---|
| `beats.py` | The narration, one entry per beat. Edit wording here. |
| `tts.py` | edge-tts (`en-IN-NeerjaNeural`, -3%): `audio/<beat>.mp3` + word timings + `durations.json` |
| `record.py` | Playwright recorder. `d.atw("word")` = act just before that word is spoken. `--dry` = fast, screenshots only |
| `assemble.py` | ffmpeg: removes the logged `cuts` (page loads), lays the audio, burns captions → `final/*.mp4` |
| `cleanup_demo.py` | deletes every "(Demo)" record the recording creates (lead, visit, task, hold, document, share) |
| `mint_session.py` / `restore_demo_user.py` | session for the test admin, and the undo afterwards |

## Run (from this folder)

```
python3 -m venv venv && venv/bin/pip install playwright edge-tts imageio-ffmpeg
venv/bin/playwright install chromium
ln -s "$(venv/bin/python -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')" ffmpeg
venv/bin/python tts.py
# session: exec mint_session.py in `bench --site erp.jewonline.in console`, save its output as sid.txt
venv/bin/python record.py --dry        # selectors + word anchors; then run cleanup_demo.py on the server
venv/bin/python record.py              # ~17 min, real time; then cleanup_demo.py again
venv/bin/python assemble.py
# finally: put the sid in /tmp/demo_sid.txt on the server and exec restore_demo_user.py
#   (display name back to "CRM Demo", the minted session deleted)
```

It writes to the LIVE CRM: every record it makes is named "(Demo)" and `cleanup_demo.py` must run after
every pass (dry or real). Never leave a take's records behind: real staff see them.

## Gotchas learned the hard way

- **Native `<select>` popups are never painted in headless video.** `choose()` / `peek()` draw an
  option list overlay instead.
- **A cut must sit between beats** (in a beat's `pre`), never inside one: a cut inside a beat pulls
  that beat's actions ahead of its words.
- **This ffmpeg build silently ignores `tpad=start_duration` after a `setpts`**, and the cloned frames
  reuse the first timestamp, so the 30 fps step drops them. That made a whole take run 1 s early.
  `assemble.py` pads by frame count and renumbers timestamps (`setpts=N/30/TB`). Check that the video and
  audio streams end within ~0.2 s of each other.
- The lead drawer's overlay covers the sidebar: a sidebar click only closes it. `d.nav()` verifies arrival.
- TTS word tokens can carry punctuation ("email."), and `t()` normalises them.
- VP8 keyframes in Playwright's webm are visibly soft (a pulse every ~5 s); `assemble.py` drops them.
- The AI email box (Ollama) was down on 26–27 Oct 2026, so that take only hovers "Draft with AI".
  `record.py` probes it at start and drafts live when it answers.
