"""
WinLab Content Calendar — 4 Week Engine
==========================================
All 12 videos defined as scenes.
Change text, commands, timing — same Apple style renderer.

Usage:
  # Single video
  manim content_calendar.py Video04 -qh --format=mp4

  # Batch all (run from PowerShell)
  foreach ($i in 1..12) { python -m manim content_calendar.py Video0$i -qh --format=mp4 }

  # Vertical versions
  foreach ($i in 1..12) { python -m manim content_calendar.py Video0${i}_Vertical -qh --format=mp4 -r 1080,1920 }

Output: vhs/output/content_Video01.mp4 ... content_Video12.mp4
"""

from manim import *

config.background_color = "#0a0a0a"

# ═══════════════════════════════════════════════════════════════
# SHARED PRIMITIVES
# ═══════════════════════════════════════════════════════════════

class Style:
    BG = "#0a0a0a"
    PANEL = "#111111"
    HEADER = "#1e1e1e"
    TEXT = "#e5e7eb"
    SUB = "#6b7280"
    ACCENT = "#3b82f6"
    SUCCESS = "#22c55e"
    ERROR = "#ef4444"
    WARNING = "#f59e00"


def fade_text(scene, text, font_size=42, color=Style.TEXT, weight=NORMAL, run_in=1.2, wait=1, run_out=0.8):
    """Fade in → wait → fade out."""
    mob = Text(text, font="Segoe UI", font_size=font_size, color=color, weight=weight)
    scene.play(FadeIn(mob, shift=UP * 0.1, run_time=run_in))
    scene.wait(wait)
    scene.play(FadeOut(mob, run_time=run_out))
    return mob


def black_pause(scene, duration=0.5):
    scene.wait(duration)


def terminal_reveal(scene, cmd, success, w=8, h=2.8, font_size=16):
    """Minimal terminal: command → success."""
    terminal = RoundedRectangle(
        width=w, height=h, corner_radius=0.2,
        fill_color=Style.PANEL, fill_opacity=0.95,
        stroke_color="#222222", stroke_width=1,
    ).shift(UP * 0.5)

    header = RoundedRectangle(
        width=w, height=0.35, corner_radius=0.2,
        fill_color=Style.HEADER, fill_opacity=1, stroke_width=0,
    ).move_to(terminal.get_top() + DOWN * 0.15)

    dots = VGroup(*[
        Circle(radius=0.05, fill_color=c, fill_opacity=0.8)
        for c in ["#ff5f57", "#febc2e", "#28c840"]
    ]).arrange(RIGHT, buff=0.1).next_to(header, LEFT, buff=0.3)

    scene.play(FadeIn(terminal, scale=0.95, run_time=1))
    scene.play(FadeIn(header), FadeIn(dots), run_time=0.4)

    cmd1 = Text(cmd, font="Consolas", font_size=font_size, color="#60a5fa")
    cmd1.next_to(header, DOWN, buff=0.35, aligned_edge=LEFT).shift(RIGHT * 0.35)
    scene.play(Write(cmd1, run_time=1))

    ok = Text(success, font="Consolas", font_size=font_size, color=Style.SUCCESS)
    ok.next_to(cmd1, DOWN, buff=0.25, aligned_edge=LEFT)
    scene.play(FadeIn(ok, run_time=0.6))
    scene.wait(0.5)

    return terminal, header, dots, cmd1, ok


def cta_close(scene, cta="WinLab.cloud", tagline="Start Free Lab →"):
    cta_m = Text(cta, font="Segoe UI", font_size=42, color=Style.ACCENT, weight=BOLD)
    tag_m = Text(tagline, font="Segoe UI", font_size=20, color=Style.SUB)
    tag_m.next_to(cta_m, DOWN, buff=0.4)

    scene.play(FadeIn(cta_m, shift=UP * 0.1, run_time=1.2))
    scene.play(FadeIn(tag_m, shift=UP * 0.1, run_time=1))
    scene.wait(1.5)
    scene.play(FadeOut(cta_m), FadeOut(tag_m), run_time=1)


# ═══════════════════════════════════════════════════════════════
# VIDEO DEFINITIONS
# ═══════════════════════════════════════════════════════════════

class Video04(Scene):
    """WEEK 2 — Demo: terraform apply → VM deployed"""
    def construct(self):
        fade_text(self, "Real infrastructure.", font_size=40)
        fade_text(self, "No setup.", font_size=44, weight=BOLD)
        terminal_reveal(self, "$ terraform apply", "✓ VM deployed", w=8, h=2.8)
        fade_text(self, "Browser-based. Instant.", font_size=30, color=Style.SUB)
        cta_close(self)


class Video05(Scene):
    """WEEK 2 — AI Mentor: doesn't give answers"""
    def construct(self):
        fade_text(self, "It doesn't give answers.", font_size=38)
        self.wait(0.5)
        fade_text(self, "It asks better questions.", font_size=42, color=Style.ACCENT, weight=BOLD)
        # Simulated AI question
        terminal_reveal(
            self,
            "AI: What does journalctl -u httpd show?",
            "→ You find the answer", w=8, h=3.2
        )
        fade_text(self, "Learn by thinking.", font_size=30, color=Style.SUB)
        cta_close(self)


class Video06(Scene):
    """WEEK 2 — Failure → Fix"""
    def construct(self):
        fade_text(self, "Break it.", font_size=48, color=Style.ERROR, weight=BOLD)
        self.wait(0.3)
        fade_text(self, "Fix it.", font_size=48, color=Style.SUCCESS, weight=BOLD)
        # Error
        terminal_reveal(
            self,
            "$ systemctl status httpd",
            "✗ Failed — timeout", w=8, h=3.2
        )
        # Fix
        terminal_reveal(
            self,
            "$ sudo systemctl restart httpd",
            "✓ Active: running", w=8, h=3.2
        )
        cta_close(self)


class Video07(Scene):
    """WEEK 3 — Interview reality: RAID"""
    def construct(self):
        fade_text(self, "This is what interviews actually test.", font_size=34)
        self.wait(0.5)
        terminal_reveal(
            self,
            "RAID degraded — disk failure",
            "✓ Rebuilt & verified", w=8, h=3.2
        )
        fade_text(self, "Not theory. Reality.", font_size=36, color=Style.ACCENT, weight=BOLD)
        cta_close(self)


class Video08(Scene):
    """WEEK 3 — Can't learn sysadmin by watching"""
    def construct(self):
        fade_text(self, "You don't learn sysadmin by watching.", font_size=36)
        self.wait(0.5)
        fade_text(self, "You learn by doing.", font_size=42, color=Style.SUCCESS, weight=BOLD)
        terminal_reveal(self, "$ your turn.", "→ Start typing", w=7, h=2.5)
        cta_close(self)


class Video09(Scene):
    """WEEK 3 — User story: 11 failures, 1 skill"""
    def construct(self):
        fade_text(self, "11 failures.", font_size=44, color=Style.ERROR)
        self.wait(0.5)
        fade_text(self, "1 real skill.", font_size=44, color=Style.SUCCESS, weight=BOLD)
        terminal_reveal(self, "Lab 11/11 completed", "✓ Certified", w=7, h=2.5)
        fade_text(self, "Real users. Real skills.", font_size=28, color=Style.SUB)
        cta_close(self)


class Video10(Scene):
    """WEEK 4 — Friction killer"""
    def construct(self):
        fade_text(self, "Free.", font_size=52, weight=BOLD)
        self.wait(0.5)
        fade_text(self, "No signup.", font_size=52, color=Style.SUCCESS, weight=BOLD)
        self.wait(0.5)
        fade_text(self, "No credit card.", font_size=40, color=Style.SUB)
        terminal_reveal(self, "Just open your browser", "→ Lab ready", w=7, h=2.5)
        cta_close(self)


class Video11(Scene):
    """WEEK 4 — Speed"""
    def construct(self):
        fade_text(self, "Takes 30 seconds to start.", font_size=38)
        # Countdown effect
        fade_text(self, "3…", font_size=60, color=Style.WARNING)
        fade_text(self, "2…", font_size=60, color=Style.WARNING)
        fade_text(self, "1…", font_size=60, color=Style.WARNING)
        fade_text(self, "Lab ready.", font_size=44, color=Style.SUCCESS, weight=BOLD)
        cta_close(self)


class Video12(Scene):
    """WEEK 4 — Final CTA"""
    def construct(self):
        fade_text(self, "Start breaking things.", font_size=48, weight=BOLD)
        self.wait(0.5)
        # Strong CTA
        terminal_reveal(self, "WinLab.cloud", "Start Free Lab →", w=8, h=2.8)
        fade_text(self, "Real skills. Zero risk.", font_size=30, color=Style.SUB)
        cta_close(self, tagline="Start Free Lab →")


# ═══════════════════════════════════════════════════════════════
# VERTICAL VERSIONS (9:16)
# All re-use the same logic with narrower terminals
# ═══════════════════════════════════════════════════════════════

def vertical_terminal(scene, cmd, success):
    return terminal_reveal(scene, cmd, success, w=4.0, h=5.5, font_size=14)


def vertical_text(scene, text, font_size=30, **kwargs):
    return fade_text(scene, text, font_size=font_size, **kwargs)


def vertical_cta(scene):
    return cta_close(scene, tagline="Start Free Lab →")


class Video04_Vertical(Scene):
    def construct(self):
        vertical_text(self, "Real infrastructure.", font_size=32)
        vertical_text(self, "No setup.", font_size=36, weight=BOLD)
        vertical_terminal(self, "$ terraform apply", "✓ VM deployed")
        vertical_text(self, "Browser-based. Instant.", font_size=24, color=Style.SUB)
        vertical_cta(self)


class Video05_Vertical(Scene):
    def construct(self):
        vertical_text(self, "It doesn't give answers.", font_size=30)
        self.wait(0.5)
        vertical_text(self, "It asks better questions.", font_size=32, color=Style.ACCENT, weight=BOLD)
        vertical_terminal(self, "AI: What does journalctl show?", "→ You find the answer")
        vertical_cta(self)


class Video06_Vertical(Scene):
    def construct(self):
        vertical_text(self, "Break it.", font_size=40, color=Style.ERROR, weight=BOLD)
        self.wait(0.3)
        vertical_text(self, "Fix it.", font_size=40, color=Style.SUCCESS, weight=BOLD)
        vertical_terminal(self, "$ systemctl status httpd", "✗ Failed — timeout")
        vertical_terminal(self, "$ sudo systemctl restart httpd", "✓ Active: running")
        vertical_cta(self)


class Video07_Vertical(Scene):
    def construct(self):
        vertical_text(self, "This is what interviews actually test.", font_size=28)
        self.wait(0.5)
        vertical_terminal(self, "RAID degraded — disk failure", "✓ Rebuilt & verified")
        vertical_text(self, "Not theory. Reality.", font_size=30, color=Style.ACCENT, weight=BOLD)
        vertical_cta(self)


class Video08_Vertical(Scene):
    def construct(self):
        vertical_text(self, "You don't learn sysadmin by watching.", font_size=28)
        self.wait(0.5)
        vertical_text(self, "You learn by doing.", font_size=34, color=Style.SUCCESS, weight=BOLD)
        vertical_terminal(self, "$ your turn.", "→ Start typing")
        vertical_cta(self)


class Video09_Vertical(Scene):
    def construct(self):
        vertical_text(self, "11 failures.", font_size=36, color=Style.ERROR)
        self.wait(0.5)
        vertical_text(self, "1 real skill.", font_size=36, color=Style.SUCCESS, weight=BOLD)
        vertical_terminal(self, "Lab 11/11 completed", "✓ Certified")
        vertical_cta(self)


class Video10_Vertical(Scene):
    def construct(self):
        vertical_text(self, "Free.", font_size=44, weight=BOLD)
        self.wait(0.5)
        vertical_text(self, "No signup.", font_size=44, color=Style.SUCCESS, weight=BOLD)
        self.wait(0.5)
        vertical_text(self, "No credit card.", font_size=32, color=Style.SUB)
        vertical_terminal(self, "Just open your browser", "→ Lab ready")
        vertical_cta(self)


class Video11_Vertical(Scene):
    def construct(self):
        vertical_text(self, "Takes 30 seconds to start.", font_size=30)
        vertical_text(self, "3…", font_size=48, color=Style.WARNING)
        vertical_text(self, "2…", font_size=48, color=Style.WARNING)
        vertical_text(self, "1…", font_size=48, color=Style.WARNING)
        vertical_text(self, "Lab ready.", font_size=36, color=Style.SUCCESS, weight=BOLD)
        vertical_cta(self)


class Video12_Vertical(Scene):
    def construct(self):
        vertical_text(self, "Start breaking things.", font_size=40, weight=BOLD)
        self.wait(0.5)
        vertical_terminal(self, "WinLab.cloud", "Start Free Lab →")
        vertical_text(self, "Real skills. Zero risk.", font_size=26, color=Style.SUB)
        vertical_cta(self)
