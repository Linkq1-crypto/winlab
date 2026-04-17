#!/usr/bin/env bash
# ─── VHS Video Generator for WinLab Terminal Scenarios ─────────────────────
#
# Prerequisites:
#   1. Install VHS: https://github.com/charmbracelet/vhs
#      macOS: brew install vhs
#      Linux: go install github.com/charmbracelet/vhs@latest
#      Windows: scoop install vhs
#
#   2. Install ffmpeg:
#      macOS: brew install ffmpeg
#      Linux: sudo apt install ffmpeg
#      Windows: scoop install ffmpeg
#
# Usage:
#   ./scripts/generate_videos.sh              # Generate all scenarios
#   ./scripts/generate_videos.sh apache_fix  # Generate single scenario
#   ./scripts/generate_videos.sh --list      # List available scenarios
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
SCENARIOS_DIR="vhs/scenarios"
OUTPUT_DIR="vhs/output"
FONT_SIZE=28
WIDTH=1280
HEIGHT=720
PADDING=40
BG_COLOR="#0a0a0a"
MARGIN=60
TYPING_SPEED="80ms"
HIDE_CURSOR=false

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─── Helper Functions ────────────────────────────────────────────────────────

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

# ─── Check Dependencies ─────────────────────────────────────────────────────

check_dependencies() {
  if ! command -v vhs &> /dev/null; then
    log_error "VHS not found. Install with:"
    echo "  macOS: brew install vhs"
    echo "  Linux: go install github.com/charmbracelet/vhs@latest"
    echo "  Windows: scoop install vhs"
    exit 1
  fi

  if ! command -v ffmpeg &> /dev/null; then
    log_error "ffmpeg not found. Install with:"
    echo "  macOS: brew install ffmpeg"
    echo "  Linux: sudo apt install ffmpeg"
    echo "  Windows: scoop install ffmpeg"
    exit 1
  fi

  log_success "Dependencies OK: vhs, ffmpeg"
}

# ─── List Scenarios ─────────────────────────────────────────────────────────

list_scenarios() {
  log_info "Available scenarios:"
  echo ""
  for scenario_file in "$SCENARIOS_DIR"/*.tape; do
    if [ -f "$scenario_file" ]; then
      scenario_name=$(basename "$scenario_file" .tape)
      echo "  • $scenario_name"
    fi
  done
  echo ""
}

# ─── Generate Single Video ─────────────────────────────────────────────────

generate_video() {
  local scenario=$1
  local input_file="$SCENARIOS_DIR/${scenario}.tape"
  local output_file="$OUTPUT_DIR/${scenario}.mp4"

  if [ ! -f "$input_file" ]; then
    log_error "Scenario file not found: $input_file"
    return 1
  fi

  log_info "Generating: $scenario → $output_file"

  # Generate video with VHS
  vhs "$input_file" \
    --output "$output_file" \
    --width "$WIDTH" \
    --height "$HEIGHT" \
    --padding "$PADDING"

  if [ -f "$output_file" ]; then
    local size=$(du -h "$output_file" | cut -f1)
    log_success "$scenario.mp4 generated ($size)"
  else
    log_error "Failed to generate $scenario.mp4"
    return 1
  fi
}

# ─── Add macOS Window Overlay (Optional Post-Processing) ────────────────────

add_macos_overlay() {
  local input_file=$1
  local output_file="${input_file%.mp4}_overlay.mp4"
  local overlay="vhs/assets/macos_window.png"

  if [ ! -f "$overlay" ]; then
    log_warn "Overlay not found: $overlay (skipping)"
    return
  fi

  log_info "Adding macOS window overlay to: $input_file"

  ffmpeg -i "$input_file" -i "$overlay" \
    -filter_complex "overlay=${MARGIN}:${MARGIN}" \
    -c:a copy \
    "$output_file"

  log_success "Overlay added: $output_file"
}

# ─── Generate Vertical Video (9:16 for Instagram/LinkedIn) ─────────────────

generate_vertical_video() {
  local input_file=$1
  local output_file="${input_file%.mp4}_vertical.mp4"

  log_info "Generating vertical version (9:16): $output_file"

  ffmpeg -i "$input_file" \
    -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 128k \
    "$output_file"

  log_success "Vertical video generated: $output_file"
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  # Create directories
  mkdir -p "$SCENARIOS_DIR" "$OUTPUT_DIR"

  # Check dependencies
  check_dependencies

  # Handle arguments
  if [ "${1:-}" = "--list" ]; then
    list_scenarios
    exit 0
  fi

  if [ -n "${1:-}" ]; then
    # Generate single scenario
    generate_video "$1"
  else
    # Generate all scenarios
    log_info "Generating all scenarios..."
    echo ""

    local count=0
    for scenario_file in "$SCENARIOS_DIR"/*.tape; do
      if [ -f "$scenario_file" ]; then
        scenario=$(basename "$scenario_file" .tape)
        generate_video "$scenario"
        count=$((count + 1))
      fi
    done

    echo ""
    log_success "Generated $count videos in $OUTPUT_DIR"
  fi
}

# Run main
main "$@"
