# Goshé. 스크립트 만들기 — 유튜브 링크 → Whisper 단어 시간 → 문장 단위 .goshe.json (iCloud Drive\Goshe)
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
    home = os.path.expanduser("~")
    for base in (os.path.join(home, "iCloudDrive"), os.path.join(home, "iCloud Drive")):
        if os.path.isdir(base):
            d = os.path.join(base, "Goshe"); os.makedirs(d, exist_ok=True); return d
    d = os.path.join(home, "Desktop", "Goshe"); os.makedirs(d, exist_ok=True)
    print("! iCloud Drive 폴더를 못 찾아서 바탕화면\\Goshe 에 저장해요"); return d

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

def group(words):
    """단어(시간 포함) → 문장. 문장부호로 끊고, 말이 오래 끊기면 끊고, 너무 길면 쉼표/틈에서 끊음"""
    out, cur = [], []
    def flush():
        if cur:
            out.append({"start": round(cur[0]["s"], 2), "end": round(cur[-1]["e"], 2),
                        "en": re.sub(r"\s+", " ", "".join(w["w"] for w in cur)).strip()})
            cur.clear()
    for i, w in enumerate(words):
        if cur and w["s"] - cur[-1]["e"] > 1.0:      # 1초 넘게 쉬면 무조건 새 문장
            flush()
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        gap = (nxt["s"] - w["e"]) if nxt else 9
        t = w["w"].strip()
        n = len(cur)
        if re.search(r"[.!?…][\"')\]]*$", t) and (n >= 3 or gap > 0.3):
            flush()
        elif n >= 22 and (re.search(r"[,;:]$", t) or gap > 0.25):
            flush()
        elif n >= 35:
            flush()
    flush()
    return out

def make(link):
    vid = vid_of(link.strip())
    if not vid:
        print("! 유튜브 링크가 아니에요"); return
    _patch_av()
    from faster_whisper import WhisperModel
    tmp = tempfile.mkdtemp()
    try:
        print("  오디오 받는 중…")
        path, title = download(vid, tmp)
        print(f"  받아쓰는 중… ({title})")
        global _model
        if "_model" not in globals():
            _model = WhisperModel(MODEL, device="cpu", compute_type="int8")
        segs, _ = _model.transcribe(path, language="en", word_timestamps=True, vad_filter=True,
                                    condition_on_previous_text=False)
        words = []
        for s in segs:
            for w in (s.words or []):
                words.append({"s": w.start, "e": w.end, "w": w.word})
            print(f"\r  {int(s.end)}초까지", end="", flush=True)
        print()
        sents = group(words)
        safe = re.sub(r'[\\/:*?"<>|]+', " ", title).strip()[:60] or vid
        f = os.path.join(out_dir(), f"{safe}.goshe.json")
        with open(f, "w", encoding="utf-8") as fp:
            json.dump({"goshe": 1, "vid": vid, "title": title, "sents": sents}, fp, ensure_ascii=False, indent=0)
        print(f"✓ {len(sents)}문장 → {f}")
    except Exception as e:
        print("! 실패:", e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    print("Goshé. 스크립트 만들기 — 유튜브 링크를 붙여넣고 Enter (끝내려면 그냥 Enter)\n")
    while True:
        l = input("링크> ").strip()
        if not l: break
        make(l)
