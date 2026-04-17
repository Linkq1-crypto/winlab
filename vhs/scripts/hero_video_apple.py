"""
WinLab Hero — Apple Style
===========================
Minimal. Slow. Silence. One idea.

Principles:
- Slow rhythm → payoff
- Zero chaos
- One single idea
- Apple uses silence as a weapon

Run:
  Horizontal: manim hero_video_apple.py AppleHero -qh --format=mp4
  Vertical:   manim hero_video_apple.py AppleHeroVertical -qh --format=mp4 -r 1080,1920
"""

from manim import *

config.background_color = "#0a0a0a"


class AppleHero(Scene):
    def construct(self):
        # ─── Palette ────────────────────────────────────────────────────
        TEXT = "#e5e7eb"
        SUB = "#6b7280"
        SUCCESS = "#22c55e"
        ACCENT = "#3b82f6"
        PANEL = "#111111"
        HEADER = "#1e1e1e"

        # ─── 0-3s: Black screen + glitch + "Connection lost." ───────────
        t1 = Text("Connection lost.", font="Inter", font_size=28, color=SUB)
        self.play(FadeIn(t1, run_time=1.5))
        # Subtle glitch
        self.play(t1.animate.shift(RIGHT * 0.08).set_opacity(0.6), run_time=0.04)
        self.play(t1.animate.shift(LEFT * 0.04), run_time=0.04)
        self.play(t1.animate.move_to([0, t1.get_center()[1], 0]), run_time=0.1)
        # ⏸ silence
        self.wait(1)
        self.play(FadeOut(t1, run_time=1))

        # ─── 3-6s: Terminal blocked + "Again." ──────────────────────────
        terminal = RoundedRectangle(
            width=8, height=3.5, corner_radius=0.2,
            fill_color=PANEL, fill_opacity=0.9,
            stroke_color="#222222", stroke_width=1,
        ).shift(UP * 0.5)

        hdr = RoundedRectangle(
            width=8, height=0.4, corner_radius=0.2,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(terminal.get_top() + DOWN * 0.18)

        dots = VGroup(*[
            Circle(radius=0.05, fill_color=c, fill_opacity=0.8)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.1).next_to(hdr, LEFT, buff=0.3)

        self.play(FadeIn(terminal, scale=0.95, run_time=1.5))
        self.play(FadeIn(hdr), FadeIn(dots), run_time=0.5)

        # Blocked line
        blocked = Text("Loading...", font="Consolas", font_size=16, color=SUB)
        blocked.next_to(hdr, DOWN, buff=0.4, aligned_edge=LEFT).shift(RIGHT * 0.4)
        self.play(FadeIn(blocked, run_time=1))
        self.wait(0.5)

        again = Text("Again.", font="Inter", font_size=22, color=SUB)
        again.to_edge(DOWN, buff=0.5)
        self.play(FadeIn(again, run_time=1))
        self.wait(0.5)
        self.play(
            FadeOut(terminal, run_time=0.8),
            FadeOut(hdr, run_time=0.8),
            FadeOut(dots, run_time=0.8),
            FadeOut(blocked, run_time=0.8),
            FadeOut(again, run_time=0.8),
        )

        # ─── 6-10s: Insight ─────────────────────────────────────────────
        i1 = Text("It's not your skills.", font="Inter", font_size=34, color=TEXT)
        self.play(FadeIn(i1, shift=UP * 0.15, run_time=1.2))
        self.wait(1)
        self.play(FadeOut(i1, run_time=0.8))

        # ⏸ pause — silence
        self.wait(0.5)

        i2 = Text("It's your connection.", font="Inter", font_size=38, color=TEXT, weight=BOLD)
        self.play(FadeIn(i2, shift=UP * 0.15, run_time=1.2))
        self.wait(1.5)
        self.play(FadeOut(i2, run_time=1))

        # ─── 10-16s: Reveal — clean terminal, slow typing ───────────────
        term2 = RoundedRectangle(
            width=8, height=3.5, corner_radius=0.2,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#222222", stroke_width=1,
        ).shift(UP * 0.5)

        hdr2 = RoundedRectangle(
            width=8, height=0.4, corner_radius=0.2,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(term2.get_top() + DOWN * 0.18)

        dots2 = VGroup(*[
            Circle(radius=0.05, fill_color=c, fill_opacity=0.8)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.1).next_to(hdr2, LEFT, buff=0.3)

        self.play(FadeIn(term2, scale=0.95, run_time=1.5))
        self.play(FadeIn(hdr2), FadeIn(dots2), run_time=0.5)

        cmd1 = Text("$ sudo systemctl restart apache2", font="Consolas", font_size=16, color="#60a5fa")
        cmd1.next_to(hdr2, DOWN, buff=0.4, aligned_edge=LEFT).shift(RIGHT * 0.4)
        self.play(Write(cmd1, run_time=1.5))

        ok = Text("Active: running", font="Consolas", font_size=16, color=SUCCESS)
        ok.next_to(cmd1, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(FadeIn(ok, run_time=0.8))
        self.wait(0.5)

        # ─── 16-20s: Message ────────────────────────────────────────────
        m1 = Text("Works offline.", font="Inter", font_size=30, color=SUCCESS)
        m1.to_edge(DOWN, buff=1)
        self.play(FadeIn(m1, shift=UP * 0.1, run_time=1))
        self.wait(0.5)

        # ⏸ pause
        self.wait(0.3)

        m2 = Text("Even on GSM.", font="Inter", font_size=30, color=SUCCESS)
        m2.next_to(m1, DOWN, buff=0.3)
        self.play(FadeIn(m2, shift=UP * 0.1, run_time=1))
        self.wait(1)

        # ─── 20-24s: Closing (Apple style) ──────────────────────────────
        self.play(
            FadeOut(term2, run_time=0.8),
            FadeOut(hdr2, run_time=0.8),
            FadeOut(dots2, run_time=0.8),
            FadeOut(cmd1, run_time=0.8),
            FadeOut(ok, run_time=0.8),
            FadeOut(m1, run_time=0.8),
            FadeOut(m2, run_time=0.8),
        )

        cta = Text("WinLab.cloud", font="Inter", font_size=42, color=ACCENT, weight=BOLD)
        cta.shift(UP * 0.3)
        self.play(FadeIn(cta, shift=UP * 0.15, run_time=1.2))
        self.wait(0.8)

        tagline = Text("Same lab. Same chance.", font="Inter", font_size=22, color=SUB)
        tagline.next_to(cta, DOWN, buff=0.4)
        self.play(FadeIn(tagline, shift=UP * 0.1, run_time=1))
        self.wait(2)

        self.play(FadeOut(cta), FadeOut(tagline), run_time=1.5)
        self.wait(0.5)


# ══════════════════════════════════════════════════════════════════════
# VERTICAL — 9:16 for LinkedIn / Instagram / TikTok
# Run: manim hero_video_apple.py AppleHeroVertical -qh --format=mp4 -r 1080,1920
# ══════════════════════════════════════════════════════════════════════

class AppleHeroVertical(Scene):
    def construct(self):
        TEXT = "#e5e7eb"
        SUB = "#6b7280"
        SUCCESS = "#22c55e"
        ACCENT = "#3b82f6"
        PANEL = "#111111"
        HEADER = "#1e1e1e"

        # ─── 0-3s ───────────────────────────────────────────────────────
        t1 = Text("Connection lost.", font="Inter", font_size=30, color=SUB)
        self.play(FadeIn(t1, run_time=1.5))
        self.play(t1.animate.shift(RIGHT * 0.08).set_opacity(0.6), run_time=0.04)
        self.play(t1.animate.shift(LEFT * 0.04), run_time=0.04)
        self.play(t1.animate.move_to([0, t1.get_center()[1], 0]), run_time=0.1)
        self.wait(1)
        self.play(FadeOut(t1, run_time=1))

        # ─── 3-6s ───────────────────────────────────────────────────────
        # Frame is 4.5 wide x 8 tall — terminal fits within
        terminal = RoundedRectangle(
            width=4.0, height=2.2, corner_radius=0.15,
            fill_color=PANEL, fill_opacity=0.9,
            stroke_color="#222222", stroke_width=1,
        ).shift(UP * 1.0)

        hdr = RoundedRectangle(
            width=4.0, height=0.32, corner_radius=0.15,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(terminal.get_top() + DOWN * 0.14)

        dots = VGroup(*[
            Circle(radius=0.04, fill_color=c, fill_opacity=0.8)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.08).next_to(hdr, LEFT, buff=0.2)

        self.play(FadeIn(terminal, scale=0.95, run_time=1.5))
        self.play(FadeIn(hdr), FadeIn(dots), run_time=0.5)

        blocked = Text("Loading...", font="Consolas", font_size=16, color=SUB)
        blocked.next_to(hdr, DOWN, buff=0.3, aligned_edge=LEFT).shift(RIGHT * 0.25)
        self.play(FadeIn(blocked, run_time=1))

        again = Text("Again.", font="Inter", font_size=24, color=SUB)
        again.to_edge(DOWN, buff=1.8)
        self.play(FadeIn(again, run_time=1))
        self.wait(0.5)

        self.play(
            *[FadeOut(m, run_time=0.8) for m in [terminal, hdr, dots, blocked, again]],
        )

        # ─── 6-10s: Insight ─────────────────────────────────────────────
        i1 = Text("It's not your skills.", font="Inter", font_size=32, color=TEXT)
        self.play(FadeIn(i1, shift=UP * 0.1, run_time=1.2))
        self.wait(1)
        self.play(FadeOut(i1, run_time=0.8))

        self.wait(0.5)

        i2 = Text("It's your connection.", font="Inter", font_size=36, color=TEXT, weight=BOLD)
        self.play(FadeIn(i2, shift=UP * 0.1, run_time=1.2))
        self.wait(1.5)
        self.play(FadeOut(i2, run_time=1))

        # ─── 10-16s: Reveal ─────────────────────────────────────────────
        term2 = RoundedRectangle(
            width=4.0, height=2.2, corner_radius=0.15,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#222222", stroke_width=1,
        ).shift(UP * 1.0)

        hdr2 = RoundedRectangle(
            width=4.0, height=0.32, corner_radius=0.15,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(term2.get_top() + DOWN * 0.14)

        dots2 = VGroup(*[
            Circle(radius=0.04, fill_color=c, fill_opacity=0.8)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.08).next_to(hdr2, LEFT, buff=0.2)

        self.play(FadeIn(term2, scale=0.95, run_time=1.5))
        self.play(FadeIn(hdr2), FadeIn(dots2), run_time=0.5)

        cmd1 = Text("$ sudo systemctl restart apache2", font="Consolas", font_size=15, color="#60a5fa")
        cmd1.next_to(hdr2, DOWN, buff=0.3, aligned_edge=LEFT).shift(RIGHT * 0.2)
        self.play(Write(cmd1, run_time=1.2))

        ok = Text("Active: running", font="Consolas", font_size=15, color=SUCCESS)
        ok.next_to(cmd1, DOWN, buff=0.25, aligned_edge=LEFT)
        self.play(FadeIn(ok, run_time=0.8))
        self.wait(0.5)

        # ─── 16-20s ─────────────────────────────────────────────────────
        m1 = Text("Works offline.", font="Inter", font_size=28, color=SUCCESS)
        m1.to_edge(DOWN, buff=2.5)
        self.play(FadeIn(m1, shift=UP * 0.1, run_time=1))
        self.wait(0.3)

        m2 = Text("Even on GSM.", font="Inter", font_size=28, color=SUCCESS)
        m2.next_to(m1, DOWN, buff=0.3)
        self.play(FadeIn(m2, shift=UP * 0.1, run_time=1))
        self.wait(1)

        # ─── 20-24s: Closing ────────────────────────────────────────────
        self.play(
            *[FadeOut(m, run_time=0.8) for m in [term2, hdr2, dots2, cmd1, ok, m1, m2]],
        )

        cta = Text("WinLab.cloud", font="Inter", font_size=40, color=ACCENT, weight=BOLD)
        cta.shift(UP * 0.5)
        self.play(FadeIn(cta, shift=UP * 0.1, run_time=1.2))
        self.wait(0.8)

        tagline = Text("Same lab. Same chance.", font="Inter", font_size=22, color=SUB)
        tagline.next_to(cta, DOWN, buff=0.4)
        self.play(FadeIn(tagline, shift=UP * 0.1, run_time=1))
        self.wait(2)

        self.play(FadeOut(cta), FadeOut(tagline), run_time=1.5)
        self.wait(0.5)
