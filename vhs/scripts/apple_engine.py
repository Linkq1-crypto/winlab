"""
WinLab Apple-Style Video Engine
=================================
Scene-based timeline renderer with 3 A/B/C variants.

Architecture:
  - Timeline engine: renderScene(scene, localT)
  - 3 variants: A (Emotiva), B (Apple Minimal), C (Provocatoria)
  - All share the same rendering primitives

Usage:
  # Render A (Emotiva)
  manim apple_engine.py VariantA -qh --format=mp4

  # Render B (Apple Minimal)
  manim apple_engine.py VariantB -qh --format=mp4

  # Render C (Provocatoria)
  manim apple_engine.py VariantC -qh --format=mp4

  # Vertical versions:
  manim apple_engine.py VariantA_Vertical -qh --format=mp4 -r 1080,1920
  manim apple_engine.py VariantB_Vertical -qh --format=mp4 -r 1080,1920
  manim apple_engine.py VariantC_Vertical -qh --format=mp4 -r 1080,1920
"""

from manim import *

config.background_color = "#0a0a0a"

# ═══════════════════════════════════════════════════════════════
# SHARED RENDERING PRIMITIVES
# ═══════════════════════════════════════════════════════════════

class ApplePrimitives:
    """Shared Apple-style rendering helpers."""

    # Colors
    BG      = "#0a0a0a"
    PANEL   = "#111111"
    HEADER  = "#1e1e1e"
    TEXT    = "#e5e7eb"
    SUB     = "#6b7280"
    ACCENT  = "#3b82f6"
    SUCCESS = "#22c55e"
    ERROR   = "#ef4444"
    WARNING = "#f59e00"

    @staticmethod
    def fade_in_text(text, font_size=42, color=TEXT, weight=NORMAL, run_time=1):
        return FadeIn(text, shift=UP * 0.1, run_time=run_time)

    @staticmethod
    def fade_out_text(mob, run_time=0.8):
        return FadeOut(mob, run_time=run_time)

    @staticmethod
    def make_text(text, font_size=42, color=TEXT, weight=NORMAL):
        return Text(text, font="Segoe UI", font_size=font_size, color=color, weight=weight)

    @staticmethod
    def draw_terminal_group(safe_area_width=8, terminal_height=3.0, font_size=16, cmd_color="#60a5fa"):
        """Creates a terminal UI group. Returns (terminal, header, dots, cmd1, ok)."""
        w = safe_area_width
        h = terminal_height

        terminal = RoundedRectangle(
            width=w, height=h, corner_radius=0.2,
            fill_color=ApplePrimitives.PANEL, fill_opacity=0.95,
            stroke_color="#222222", stroke_width=1,
        ).move_to(ORIGIN)

        header = RoundedRectangle(
            width=w, height=0.4, corner_radius=0.2,
            fill_color=ApplePrimitives.HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(terminal.get_top() + DOWN * 0.18)

        dots = VGroup(*[
            Circle(radius=0.05, fill_color=c, fill_opacity=0.8)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.1).next_to(header, LEFT, buff=0.3)

        cmd1 = Text("$ sudo systemctl restart apache2", font="Consolas", font_size=font_size, color=cmd_color)
        cmd1.next_to(header, DOWN, buff=0.4, aligned_edge=LEFT).shift(RIGHT * 0.4)

        ok = Text("✓ Active: running", font="Consolas", font_size=font_size, color=ApplePrimitives.SUCCESS)
        ok.next_to(cmd1, DOWN, buff=0.3, aligned_edge=LEFT)

        return terminal, header, dots, cmd1, ok


# ═══════════════════════════════════════════════════════════════
# SCENE BUILDERS — each variant uses these building blocks
# ═══════════════════════════════════════════════════════════════

def build_text_scene(scene, text, font_size=42, color=ApplePrimitives.TEXT, weight=NORMAL):
    """Generic text scene: fade in → wait → fade out."""
    mob = ApplePrimitives.make_text(text, font_size=font_size, color=color, weight=weight)
    scene.play(FadeIn(mob, shift=UP * 0.1, run_time=1.2))
    scene.wait(1)
    scene.play(FadeOut(mob, run_time=0.8))


def build_terminal_scene(scene, safe_area_width=8, terminal_height=3.0, font_size=16):
    """Terminal reveal scene."""
    terminal, header, dots, cmd1, ok = ApplePrimitives.draw_terminal_group(
        safe_area_width=safe_area_width, terminal_height=terminal_height, font_size=font_size
    )
    scene.play(FadeIn(terminal, scale=0.95, run_time=1.2))
    scene.play(FadeIn(header), FadeIn(dots), run_time=0.5)
    scene.play(Write(cmd1, run_time=1.2))
    scene.play(FadeIn(ok, run_time=0.8))
    scene.wait(0.5)
    return terminal, header, dots, cmd1, ok


def build_black_scene(scene):
    """Just a black screen pause."""
    scene.wait(0.5)


def build_logo_scene(scene):
    """WinLab.cloud logo + tagline."""
    cta = Text("WinLab.cloud", font="Segoe UI", font_size=42, color=ApplePrimitives.ACCENT, weight=BOLD)
    tagline = Text("Same lab. Same chance.", font="Segoe UI", font_size=20, color=ApplePrimitives.SUB)
    tagline.next_to(cta, DOWN, buff=0.4)

    scene.play(FadeIn(cta, shift=UP * 0.1, run_time=1.2))
    scene.wait(0.5)
    scene.play(FadeIn(tagline, shift=UP * 0.1, run_time=1))
    scene.wait(1.5)
    scene.play(FadeOut(cta), FadeOut(tagline), run_time=1)


# ═══════════════════════════════════════════════════════════════
# VARIANT A — EMOTIVA (Empathy)
# Scenes: Connection lost → Again → Same skills → Different outcome → Terminal → Same lab
# ═══════════════════════════════════════════════════════════════

class VariantA(Scene):
    def construct(self):
        t = ApplePrimitives()

        # Connection lost (with micro-glitch)
        mob = t.make_text("Connection lost.", font_size=36, color=t.SUB)
        self.play(FadeIn(mob, run_time=1.5))
        self.play(mob.animate.shift(RIGHT * 0.08).set_opacity(0.6), run_time=0.04)
        self.play(mob.animate.shift(LEFT * 0.04), run_time=0.04)
        self.play(mob.animate.move_to([0, mob.get_center()[1], 0]), run_time=0.1)
        self.wait(1)
        self.play(FadeOut(mob, run_time=1))

        # Again
        build_text_scene(self, "Again.", font_size=30, color=t.SUB)

        # Same skills → Different outcome
        build_text_scene(self, "Same skills.", font_size=36, color=t.TEXT)
        build_text_scene(self, "Different outcome.", font_size=40, color=t.TEXT, weight=BOLD)

        # Terminal
        build_terminal_scene(self, safe_area_width=8, font_size=16)

        # Same lab. Same chance.
        build_logo_scene(self)


# ═══════════════════════════════════════════════════════════════
# VARIANT B — APPLE MINIMAL (Ultra Clean)
# Scenes: Black → It's not your skills → It's your connection → Terminal → Works offline → Logo
# ═══════════════════════════════════════════════════════════════

class VariantB(Scene):
    def construct(self):
        t = ApplePrimitives()

        # Black pause
        self.wait(1)

        # It's not your skills
        build_text_scene(self, "It's not your skills.", font_size=38, color=t.TEXT)

        # ⏸ Silence
        self.wait(0.5)

        # It's your connection (the punch)
        build_text_scene(self, "It's your connection.", font_size=42, color=t.TEXT, weight=BOLD)

        # Terminal
        build_terminal_scene(self, safe_area_width=8, font_size=16)

        # Works offline
        mob = t.make_text("Works offline.", font_size=34, color=t.SUCCESS)
        self.play(FadeIn(mob, shift=UP * 0.1, run_time=1))
        self.wait(0.3)
        self.play(FadeOut(mob, run_time=0.8))

        # Logo
        build_logo_scene(self)


# ═══════════════════════════════════════════════════════════════
# VARIANT C — PROVOCATORIA (Viral)
# Scenes: Some learn on fiber → Others try on a SIM card → We fixed that → Terminal → Logo
# ═══════════════════════════════════════════════════════════════

class VariantC(Scene):
    def construct(self):
        t = ApplePrimitives()

        # Some learn on fiber
        build_text_scene(self, "Some learn on fiber.", font_size=36, color=t.TEXT)

        # Others try on a SIM card
        build_text_scene(self, "Others try on a SIM card.", font_size=36, color=t.SUB)

        # We fixed that (the punch)
        build_text_scene(self, "We fixed that.", font_size=42, color=t.ACCENT, weight=BOLD)

        # Terminal
        build_terminal_scene(self, safe_area_width=8, font_size=16)

        # Logo
        build_logo_scene(self)


# ═══════════════════════════════════════════════════════════════
# VERTICAL VERSIONS (9:16 for LinkedIn / Instagram / TikTok)
# ═══════════════════════════════════════════════════════════════

class VariantA_Vertical(Scene):
    def construct(self):
        t = ApplePrimitives()

        mob = t.make_text("Connection lost.", font_size=28, color=t.SUB)
        self.play(FadeIn(mob, run_time=1.5))
        self.play(mob.animate.shift(RIGHT * 0.08).set_opacity(0.6), run_time=0.04)
        self.play(mob.animate.shift(LEFT * 0.04), run_time=0.04)
        self.play(mob.animate.move_to([0, mob.get_center()[1], 0]), run_time=0.1)
        self.wait(1)
        self.play(FadeOut(mob, run_time=1))

        build_text_scene(self, "Again.", font_size=24, color=t.SUB)
        build_text_scene(self, "Same skills.", font_size=28, color=t.TEXT)
        build_text_scene(self, "Different outcome.", font_size=32, color=t.TEXT, weight=BOLD)

        build_terminal_scene(self, safe_area_width=4.2, terminal_height=6.0, font_size=14)

        build_logo_scene(self)


class VariantB_Vertical(Scene):
    def construct(self):
        t = ApplePrimitives()

        self.wait(1)
        build_text_scene(self, "It's not your skills.", font_size=30, color=t.TEXT)
        self.wait(0.5)
        build_text_scene(self, "It's your connection.", font_size=34, color=t.TEXT, weight=BOLD)

        build_terminal_scene(self, safe_area_width=4.2, terminal_height=6.0, font_size=14)

        mob = t.make_text("Works offline.", font_size=26, color=t.SUCCESS)
        self.play(FadeIn(mob, shift=UP * 0.1, run_time=1))
        self.wait(0.3)
        self.play(FadeOut(mob, run_time=0.8))

        build_logo_scene(self)


class VariantC_Vertical(Scene):
    def construct(self):
        t = ApplePrimitives()

        build_text_scene(self, "Some learn on fiber.", font_size=28, color=t.TEXT)
        build_text_scene(self, "Others try on a SIM card.", font_size=28, color=t.SUB)
        build_text_scene(self, "We fixed that.", font_size=32, color=t.ACCENT, weight=BOLD)

        build_terminal_scene(self, safe_area_width=4.2, terminal_height=6.0, font_size=14)

        build_logo_scene(self)
