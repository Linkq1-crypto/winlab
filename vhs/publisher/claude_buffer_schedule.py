#!/usr/bin/env python3
"""
WinLab — Auto scheduler
1. Legge i .mp4 da vhs/output/prelaunch/
2. Costruisce URL pubblici su Cloudflare R2
3. Chiama Claude API per generare caption + hashtag da nome file
4. Schedula ogni post su Buffer, uno al giorno alle 10:00 Roma
   partendo da domani

.env richiesto:
  BUFFER_TOKEN       - token OAuth Buffer (da buffer.com/developers/apps)
  ANTHROPIC_API_KEY  - chiave Anthropic
  R2_BASE_URL        - es. https://pub-xxx.r2.dev/prelaunch
  BUFFER_PLATFORMS   - opzionale, default: instagram,tiktok,linkedin,youtube
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import anthropic
import requests

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv(Path(__file__).parent / ".env")

BUFFER_TOKEN  = os.getenv("BUFFER_TOKEN")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
R2_BASE_URL   = os.getenv("R2_BASE_URL", "").rstrip("/")
PLATFORMS_ENV = os.getenv("BUFFER_PLATFORMS", "instagram,tiktok,linkedin,youtube")
PLATFORMS     = [p.strip() for p in PLATFORMS_ENV.split(",") if p.strip()]

VIDEO_DIR     = Path(__file__).parent.parent / "output" / "prelaunch"
BUFFER_API    = "https://api.bufferapp.com/1"
# Orari fissi 17-20 aprile (UTC — Roma è UTC+2)
FIXED_SCHEDULE = [
    "2026-04-17T16:00:00Z",  # Ven 18:00 Roma — fri_01
    "2026-04-17T18:00:00Z",  # Ven 20:00 Roma — fri_02
    "2026-04-17T19:00:00Z",  # Ven 21:00 Roma — fri_03
    "2026-04-18T10:00:00Z",  # Sab 12:00 Roma — sat_04
    "2026-04-18T13:00:00Z",  # Sab 15:00 Roma — sat_05
    "2026-04-18T17:00:00Z",  # Sab 19:00 Roma — sat_06
    "2026-04-19T08:00:00Z",  # Dom 10:00 Roma — sun_07
    "2026-04-19T12:00:00Z",  # Dom 14:00 Roma — sun_08
    "2026-04-19T16:00:00Z",  # Dom 18:00 Roma — sun_09
    "2026-04-20T06:00:00Z",  # Lun 08:00 Roma — mon_10
    "2026-04-20T12:00:00Z",  # Lun 14:00 Roma — mon_11
    "2026-04-20T18:00:00Z",  # Lun 20:00 Roma — mon_12 (GO LIVE)
]

# ── Validazione ───────────────────────────────────────────────────────────────

errors = []
if not BUFFER_TOKEN:  errors.append("BUFFER_TOKEN mancante nel .env")
if not ANTHROPIC_KEY: errors.append("ANTHROPIC_API_KEY mancante nel .env")
if not R2_BASE_URL:   errors.append("R2_BASE_URL mancante nel .env")
if errors:
    print("\n".join(f"  ✗ {e}" for e in errors))
    sys.exit(1)

# ── Buffer helpers ────────────────────────────────────────────────────────────

def buffer_get(path):
    r = requests.get(f"{BUFFER_API}{path}", params={"access_token": BUFFER_TOKEN})
    r.raise_for_status()
    return r.json()

def buffer_post(path, data):
    r = requests.post(f"{BUFFER_API}{path}", data={**data, "access_token": BUFFER_TOKEN})
    r.raise_for_status()
    return r.json()

def get_profile_ids():
    """Restituisce {service_name: profile_id} per i profili collegati."""
    profiles = buffer_get("/profiles.json")
    return {p["service"]: p["id"] for p in profiles if p["service"] in PLATFORMS}

def schedule_update(profile_id, text, media_url, scheduled_at_iso):
    """Schedula un post su Buffer con media URL e orario ISO."""
    ts = int(datetime.fromisoformat(scheduled_at_iso.replace("Z", "+00:00")).timestamp())
    data = {
        f"profile_ids[]":   profile_id,
        "text":             text,
        "scheduled_at":     ts,
        "media[link]":      media_url,
    }
    return buffer_post("/updates/create.json", data)

# ── Claude helper ─────────────────────────────────────────────────────────────

client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

def generate_caption(filename: str, platform: str) -> str:
    """Genera caption + hashtag per il video dato il nome file e la piattaforma."""
    slug = filename.replace(".mp4", "").replace("_", " ").replace("prelaunch ", "")

    prompt = f"""Sei il social media manager di WinLab, un simulatore sysadmin browser-based.
Genera una caption per {platform.upper()} per questo video: "{slug}"

WinLab permette di fare lab Linux, vSphere, RAID, SSSD, Terraform nel browser senza VM.
Early access: $5 (poi $19). 500 posti. Sito: WinLab.cloud

Regole per {platform}:
{"- Max 2200 caratteri, hook forte nella prima riga, emoji moderate, 5-8 hashtag" if platform == "instagram" else ""}
{"- Max 150 caratteri + hashtag separati, hook provocatorio, 3-5 hashtag" if platform == "tiktok" else ""}
{"- Tono professionale, prima riga come titolo, no emoji eccessive, 3-5 hashtag professionali" if platform == "linkedin" else ""}
{"- Titolo accattivante (va nel campo description), tono educativo, 3-5 hashtag" if platform == "youtube" else ""}

Rispondi SOLO con la caption pronta da copiare, niente spiegazioni."""

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()

# ── Main ──────────────────────────────────────────────────────────────────────

def main(dry=False):
    # Trova tutti i .mp4 in ordine alfabetico
    videos = sorted(VIDEO_DIR.glob("*.mp4"))
    if not videos:
        print(f"Nessun .mp4 trovato in {VIDEO_DIR}")
        sys.exit(1)

    print(f"\nTrovati {len(videos)} video in {VIDEO_DIR}\n")

    # Profili Buffer
    print("Recupero profili Buffer...")
    try:
        profile_map = get_profile_ids()
    except Exception as e:
        print(f"✗ Errore profili Buffer: {e}")
        sys.exit(1)

    active = [p for p in PLATFORMS if p in profile_map]
    missing = [p for p in PLATFORMS if p not in profile_map]
    print(f"  Profili attivi: {', '.join(active) or 'nessuno'}")
    if missing:
        print(f"  Mancanti (non collegati su Buffer): {', '.join(missing)}")
    if not active:
        print("✗ Nessun profilo Buffer collegato. Collegali su buffer.com")
        sys.exit(1)
    print()

    results = []

    if len(videos) != len(FIXED_SCHEDULE):
        print(f"⚠  {len(videos)} video trovati ma lo schedule prevede {len(FIXED_SCHEDULE)} slot.")
        print("   I video verranno abbinati in ordine; quelli in eccesso vengono ignorati.\n")

    for i, (video_path, post_iso) in enumerate(zip(videos, FIXED_SCHEDULE)):
        filename  = video_path.name
        video_url = f"{R2_BASE_URL}/{filename}"
        post_dt   = datetime.fromisoformat(post_iso.replace("Z", "+00:00"))
        post_roma = (post_dt + timedelta(hours=2)).strftime("%d/%m %H:%M")

        print(f"[{i+1}/{len(videos)}] {filename}")
        print(f"  URL:   {video_url}")
        print(f"  Orario: {post_roma} Roma  ({post_iso})")

        for platform in active:
            print(f"  Genero caption per {platform}...")
            try:
                caption = generate_caption(filename, platform)
                print(f"  Caption: {caption[:80].replace(chr(10), ' ')}...")
            except Exception as e:
                print(f"  ✗ Claude error: {e}")
                continue

            if dry:
                print(f"  [DRY] Schedulerei su {platform} @ {post_roma}")
            else:
                try:
                    res = schedule_update(
                        profile_id   = profile_map[platform],
                        text         = caption,
                        media_url    = video_url,
                        scheduled_at_iso = post_iso,
                    )
                    print(f"  ✓ Schedulato su {platform}  (id={res.get('id', '—')})")
                    results.append({"video": filename, "platform": platform, "at": post_roma, "id": res.get("id")})
                except Exception as e:
                    print(f"  ✗ Buffer error su {platform}: {e}")

        print()

    if not dry:
        print(f"✓ Completato: {len(results)} post schedulati.\n")
        # Salva riepilogo
        out = Path(__file__).parent / "scheduled_posts.json"
        out.write_text(json.dumps(results, indent=2, ensure_ascii=False))
        print(f"  Riepilogo salvato in: {out}\n")

if __name__ == "__main__":
    dry = "--dry" in sys.argv
    if dry:
        print("\n[DRY RUN] Nessun post verrà pubblicato.\n")
    main(dry=dry)
