# Goshé. 스크립트 만들기 — 유튜브 링크 → Whisper 단어 시간 → 문장 단위 .goshe.json (회사 원드라이브\Goshe)
import os, re, sys, json, glob, tempfile, shutil, warnings
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("HF_HUB_DISABLE_IMPLICIT_TOKEN", "1")
warnings.filterwarnings("ignore")

def _patch_av():
    """새 PyAV는 faster-whisper가 넘기는 metadata_errors 인자를 없앴음 → 빼고 호출"""
    try:
        import av
        if getattr(av, "_goshe", False): return
        _open = av.open
        def op(*a, **k):
            k.pop("metadata_errors", None); return _open(*a, **k)
        av.open = op; av._goshe = True
    except Exception: pass

MODEL = os.environ.get("GOSHE_MODEL", "medium.en")   # 느리면 small.en

def out_dir():
    """회사 원드라이브(OneDrive - 회사이름)\\Goshe 에 저장. 없으면 iCloud Drive, 그것도 없으면 바탕화면"""
    home = os.path.expanduser("~")
    bases = [os.environ.get("OneDriveCommercial")]
    bases += sorted(glob.glob(os.path.join(home, "OneDrive - *")))      # 환경변수가 없을 때 폴더 이름으로 찾기
    bases += [os.path.join(home, "iCloudDrive"), os.path.join(home, "iCloud Drive")]
    for base in bases:
        if base and os.path.isdir(base):
            d = os.path.join(base, "Goshe"); os.makedirs(d, exist_ok=True); return d
    d = os.path.join(home, "Desktop", "Goshe"); os.makedirs(d, exist_ok=True)
    print("! 원드라이브·iCloud Drive 폴더를 못 찾아서 바탕화면\\Goshe 에 저장해요"); return d

def vid_of(u):
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/|live/)([A-Za-z0-9_-]{11})", u)
    return m.group(1) if m else (u if re.fullmatch(r"[A-Za-z0-9_-]{11}", u) else None)

def download(vid, tmp):
    import yt_dlp
    opt = {"format": "bestaudio[ext=m4a]/bestaudio/best", "outtmpl": os.path.join(tmp, "a.%(ext)s"),
           "quiet": True, "no_warnings": True, "noplaylist": True}
    with yt_dlp.YoutubeDL(opt) as y:
        info = y.extract_info("https://www.youtube.com/watch?v=" + vid, download=True)
    return glob.glob(os.path.join(tmp, "a.*"))[0], info.get("title") or vid

def human_subs(vid, tmp):
    """사람이 만든 영어 자막이 있으면 받아서 문장 목록으로 (없으면 None). 시간은 자막 파일의 ms 단위 그대로"""
    import yt_dlp
    base = {"quiet": True, "no_warnings": True, "noplaylist": True, "skip_download": True}
    with yt_dlp.YoutubeDL(base) as y:
        info = y.extract_info("https://www.youtube.com/watch?v=" + vid, download=False)
    title = info.get("title") or vid
    langs = [k for k in (info.get("subtitles") or {}) if k == "en" or k.startswith("en-") or k.startswith("en_")]
    if not langs:
        return None, title
    lang = "en" if "en" in langs else langs[0]
    opt = dict(base, writesubtitles=True, writeautomaticsub=False, subtitleslangs=[lang],
               subtitlesformat="json3", outtmpl=os.path.join(tmp, "s"))
    with yt_dlp.YoutubeDL(opt) as y:
        y.download(["https://www.youtube.com/watch?v=" + vid])
    fs = glob.glob(os.path.join(tmp, "s*.json3"))
    if not fs:
        return None, title
    ev = json.load(open(fs[0], encoding="utf-8")).get("events") or []
    out = []
    for e in ev:
        if "tStartMs" not in e:
            continue
        raw = "".join(g.get("utf8", "") for g in (e.get("segs") or []))
        raw = re.sub(r"\[[^\]]*\]|\([^)]*\)|[♪♫]", " ", raw)      # [whispering], (laughs), ♪ 같은 지문은 뺌
        parts = [re.sub(r"\s+", " ", x).strip() for x in re.split(r"(?:^|\n)\s*-\s+", raw)]   # "- 대사" = 화자 바뀜
        parts = [x for x in parts if re.search(r"[A-Za-z0-9]", x)]
        if not parts:
            continue
        a = e["tStartMs"] / 1000; b = a + max(e.get("dDurationMs") or 0, 300) / 1000
        tot = sum(len(x) for x in parts); at = a
        for x in parts:                                   # 화자가 둘이면 글자 수 비율로 시간 나눔
            nb = at + (b - a) * len(x) / tot
            if not (out and abs(out[-1]["start"] - round(at, 2)) < 0.01 and out[-1]["en"] == x):
                out.append({"start": round(at, 2), "end": round(nb, 2), "en": x})
            at = nb
    out.sort(key=lambda x: x["start"])
    for i in range(len(out) - 1):                      # 다음 줄과 겹치지 않게
        out[i]["end"] = min(out[i]["end"], out[i + 1]["start"]) if out[i + 1]["start"] > out[i]["start"] else out[i]["end"]
    return (out or None), title

def load_audio(path):
    """오디오를 직접 16kHz 모노로 풀어서 넘김 (faster-whisper의 PyAV 호출을 거치지 않음)"""
    import av, numpy as np
    out = []
    with av.open(path) as c:
        st = c.streams.audio[0]
        rs = av.AudioResampler(format="s16", layout="mono", rate=16000)
        def put(frames):
            if frames is None: return
            if not isinstance(frames, list): frames = [frames]
            for f in frames: out.append(f.to_ndarray().reshape(-1))
        for fr in c.decode(st):
            fr.pts = None
            put(rs.resample(fr))
        try: put(rs.resample(None))
        except Exception: pass
    return np.concatenate(out).astype(np.float32) / 32768.0

def group(words):
    """단어(시간 포함) → 문장. 문장부호로 끊고, 말이 오래 끊기면 끊고, 너무 길면 쉼표/틈에서 끊음"""
    out, cur = [], []
    def flush():
        if cur:
            out.append({"start": round(cur[0]["s"], 2), "end": round(cur[-1]["e"], 2),
                        "en": re.sub(r"\s+", " ", "".join(w["w"] for w in cur)).strip(),
                        "w": [[w["w"].strip(), round(w["s"], 2), round(w["e"], 2)] for w in cur if w["w"].strip()]})
            cur.clear()
    for i, w in enumerate(words):
        if cur and w["s"] - cur[-1]["e"] > 1.0:      # 1초 넘게 쉬면 무조건 새 문장
            flush()
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        gap = (nxt["s"] - w["e"]) if nxt else 9
        t = w["w"].strip()
        n = len(cur)
        if re.search(r"[.!?…][\"')\]]*$", t):   # 문장 끝이면 무조건 끊음 (짧은 대답이 다음 사람 말에 붙지 않게)
            flush()
        elif n >= 22 and (re.search(r"[,;:]$", t) or gap > 0.25):
            flush()
        elif n >= 35:
            flush()
    flush()
    return out

def save(vid, title, sents, how):
    safe = re.sub(r'[\\/:*?"<>|]+', " ", title).strip()[:60] or vid
    f = os.path.join(out_dir(), f"{safe}.goshe.json")
    with open(f, "w", encoding="utf-8") as fp:
        json.dump({"goshe": 2, "vid": vid, "title": title, "src": how, "sents": sents}, fp, ensure_ascii=False, indent=0)
    print(f"✓ {how} · {len(sents)}문장 → {f}")

def make(link):
    link = link.strip(); force_w = False
    if link[:2].lower() == "w ":
        force_w = True; link = link[2:].strip()
    vid = vid_of(link)
    if not vid:
        print("! 유튜브 링크가 아니에요"); return
    _patch_av()
    from faster_whisper import WhisperModel
    tmp = tempfile.mkdtemp()
    try:
        if not force_w:
            print("  자막 확인 중…")
            try:
                sents, title = human_subs(vid, tmp)
            except Exception as e:
                sents, title = None, vid; print("  (자막 확인 실패:", e, ")")
            if sents:
                save(vid, title, sents, "사람 자막"); return
            print("  사람이 만든 자막이 없어서 Whisper로 받아써요")
        print("  오디오 받는 중…")
        path, title = download(vid, tmp)
        print(f"  받아쓰는 중… ({title})")
        global _model
        if "_model" not in globals():
            _model = WhisperModel(MODEL, device="cpu", compute_type="int8")
        segs, _ = _model.transcribe(load_audio(path), language="en", word_timestamps=True, vad_filter=True,
                                    condition_on_previous_text=False,
                                    initial_prompt="Hello. How are you? I'm fine, thanks. Wait, what? No, no, no. Okay.")
        words = []
        for s in segs:
            for w in (s.words or []):
                words.append({"s": w.start, "e": w.end, "w": w.word})
            print(f"\r  {int(s.end)}초까지", end="", flush=True)
        print()
        save(vid, title, group(words), "Whisper")
    except Exception as e:
        print("! 실패:", e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    print("Goshé. 스크립트 만들기 — 유튜브 링크를 붙여넣고 Enter (끝내려면 그냥 Enter)")
    print("사람이 만든 자막이 있으면 그걸 쓰고, 없으면 Whisper로 받아써요. 무조건 Whisper로 하려면 링크 앞에 w 와 띄어쓰기\n")
    while True:
        l = input("링크> ").strip()
        if not l: break
        make(l)
