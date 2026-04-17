"""
WinLab — Pre-launch Day
========================
"Friday. Early access is open."
Pre-launch announcement video — Stripe opens Apr 17, app live Apr 20.

Run:
  Horizontal: manim launch_day.py LaunchDay -qh --format=mp4
  Vertical:   manim launch_day.py LaunchDayVertical -qh --format=mp4 -r 1080,1920
"""

from manim import *

config.background_color = "#0a0a0a"


class LaunchDay(Scene):
    def construct(self):
        TEXT  = "#e5e7eb"
        SUB   = "#6b7280"
        GREEN = "#22c55e"
        BLUE  = "#3b82f6"
        DIM   = "#374151"

        # ─── 0-2s: Black. Nothing. ───────────────────────────────────────
        self.wait(1.5)

        # ─── 2-5s: Date fades in, alone ─────────────────────────────────
        date = Text("April 17, 2026", font="Inter", font_size=22, color=SUB)
        self.play(FadeIn(date, run_time=1.5))
        self.wait(1.2)
        self.play(FadeOut(date, run_time=0.8))
        self.wait(0.4)

        # ─── 5-8s: "It's here." ─────────────────────────────────────────
        here = Text("It's here.", font="Inter", font_size=52, color=TEXT, weight=BOLD)
        self.play(FadeIn(here, shift=UP * 0.12, run_time=1.4))
        self.wait(2.2)
        self.play(FadeOut(here, run_time=1))
        self.wait(0.3)

        # ─── 8-13s: Terminal boots ───────────────────────────────────────
        PANEL  = "#111111"
        HEADER = "#1a1a1a"

        term = RoundedRectangle(
            width=8.5, height=4, corner_radius=0.2,
            fill_color=PANEL, fill_opacity=0.97,
            stroke_color="#222222", stroke_width=1,
        )
        hdr = RoundedRectangle(
            width=8.5, height=0.42, corner_radius=0.2,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(term.get_top() + DOWN * 0.19)
        dots = VGroup(*[
            Circle(radius=0.055, fill_color=c, fill_opacity=0.85)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.12).move_to(hdr).align_to(hdr, LEFT).shift(RIGHT * 0.2)
        title_bar = Text("winlab — bash", font="Consolas", font_size=11, color=DIM)
        title_bar.move_to(hdr)

        self.play(FadeIn(term, scale=0.96, run_time=1.2))
        self.play(FadeIn(hdr), FadeIn(dots), FadeIn(title_bar), run_time=0.4)

        # Boot lines
        lines = [
            ("$ ", "#6b7280", "ssh admin@winlab.cloud", "#60a5fa"),
            ("", "", "Connected. Welcome back.", "#22c55e"),
            ("$ ", "#6b7280", "sudo systemctl status nginx", "#60a5fa"),
            ("", "", "● nginx.service — Active: running ✓", "#22c55e"),
        ]
        group = VGroup()
        y_start = hdr.get_bottom() + DOWN * 0.35
        for i, (p, pc, cmd, cc) in enumerate(lines):
            row = VGroup(
                Text(p, font="Consolas", font_size=15, color=pc),
                Text(cmd, font="Consolas", font_size=15, color=cc),
            ).arrange(RIGHT, buff=0.05)
            row.align_to(term, LEFT).shift(RIGHT * 0.35)
            row.move_to([row.get_center()[0], y_start[1] - i * 0.42, 0])
            group.add(row)
            if i < 2:
                self.play(Write(row, run_time=0.7))
            else:
                self.play(FadeIn(row, run_time=0.5))

        self.wait(0.6)

        # ─── 13-17s: "WinLab is live." ──────────────────────────────────
        self.play(
            FadeOut(term), FadeOut(hdr), FadeOut(dots),
            FadeOut(title_bar), FadeOut(group), run_time=0.9
        )
        self.wait(0.2)

        live = Text("WinLab is live.", font="Inter", font_size=48, color=GREEN, weight=BOLD)
        self.play(FadeIn(live, shift=UP * 0.1, run_time=1.2))
        self.wait(0.8)

        sub = Text("500 seats. $5/mo. Yours forever.", font="Inter", font_size=22, color=SUB)
        sub.next_to(live, DOWN, buff=0.5)
        self.play(FadeIn(sub, shift=UP * 0.08, run_time=1))
        self.wait(1.5)

        # ─── 17-21s: CTA ────────────────────────────────────────────────
        self.play(FadeOut(live, run_time=0.7), FadeOut(sub, run_time=0.7))
        self.wait(0.2)

        cta = Text("winlab.cloud", font="Inter", font_size=44, color=BLUE, weight=BOLD)
        self.play(FadeIn(cta, shift=UP * 0.1, run_time=1.2))
        self.wait(2.5)
        self.play(FadeOut(cta, run_time=1.2))


class LaunchDayVertical(Scene):
    """9:16 vertical — same script, spacing adjusted"""
    def construct(self):
        config.frame_width  = 9
        config.frame_height = 16
        LaunchDay.construct(self)
