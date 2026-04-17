#!/usr/bin/env bash
# ─── Batch Generate ALL WinLab Terminal Videos ─────────────────────────────
#
# Generates all VHS scenarios + creates vertical versions for social media
# Perfect for: YouTube (16:9) + Instagram/LinkedIn (9:16)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
section() { echo -e "\n${CYAN}══ $1 ══${NC}"; }

# Create output dir
mkdir -p vhs/output vhs/output/vertical vhs/output/thumbnails

section "WINLAB VIDEO GENERATOR - BATCH MODE"

# Check VHS
if ! command -v vhs &> /dev/null; then
  error "VHS not installed. Run: brew install vhs"
  exit 1
fi

section "Generating Horizontal Videos (16:9 - YouTube)"

videos=()

for tape in vhs/scenarios/*.tape; do
  scenario=$(basename "$tape" .tape)
  output="vhs/output/${scenario}.mp4"
  
  log "Generating: $scenario"
  
  vhs "$tape" \
    --output "$output" \
    --width 1280 \
    --height 720 \
    --padding 40 \
    --margin 60
  
  if [ -f "$output" ]; then
    size=$(du -h "$output" | cut -f1)
    success "$scenario.mp4 ($size)"
    videos+=("$scenario")
  else
    error "Failed: $scenario"
  fi
done

section "Generating Vertical Videos (9:16 - Instagram/LinkedIn)"

for scenario in "${videos[@]}"; do
  input="vhs/output/${scenario}.mp4"
  vertical="vhs/output/vertical/${scenario}_vertical.mp4"
  
  log "Converting to vertical: $scenario"
  
  ffmpeg -i "$input" \
    -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$vertical"
  
  if [ -f "$vertical" ]; then
    size=$(du -h "$vertical" | cut -f1)
    success "${scenario}_vertical.mp4 ($size)"
  else
    error "Failed vertical conversion: $scenario"
  fi
done

section "Generating Thumbnails (First Frame)"

for scenario in "${videos[@]}"; do
  input="vhs/output/${scenario}.mp4"
  thumb="vhs/output/thumbnails/${scenario}_thumb.jpg"
  
  ffmpeg -i "$input" -vf "thumbnail,scale=1280:720" \
    -frames:v 1 -q:v 2 "$thumb"
  
  success "Thumbnail: ${scenario}_thumb.jpg"
done

section "GENERATION COMPLETE"

echo -e "${GREEN}Total videos generated: ${#videos[@]}${NC}"
echo ""
echo -e "${BLUE}Horizontal (YouTube):${NC}  vhs/output/*.mp4"
echo -e "${BLUE}Vertical (Social):${NC}    vhs/output/vertical/*.mp4"
echo -e "${BLUE}Thumbnails:${NC}           vhs/output/thumbnails/*.jpg"
echo ""
echo -e "${YELLOW}Ready to upload to YouTube + LinkedIn!${NC}"
