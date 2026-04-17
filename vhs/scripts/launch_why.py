"""
WinLab — Why WinLab
=====================
"You watched 47 tutorials. Still stuck?"
Pain point → solution video.

Run:
  Horizontal: manim launch_why.py WhyWinLab -qh --format=mp4
  Vertical:   manim launch_why.py WhyWinLabVertical -qh --format=mp4 -r 1080,1920
"""

from manim import *

config.background_color = "#0a0a0a"


class WhyWinLab(Scene):
    def construct(self):
        TEXT  = "#e5e7eb"
        SUB   = "#6b7280"
        GREEN = "#22c55e"
        RED   = "#ef4444"
        DIM   = "#374151"

        # ─── 0-1.5s: Silence ────────────────────────────────────────────
        self.wait(1.5)

        # ─── 1.5-5s: Pain. Videos watched counter. ──────────────────────
        watched_label = Text("tutorials watched", font="Inter", font_size=16, color=SUB)
        watched_label.shift(UP * 0.7)

        watched_num = Integer(0, font_size=80, color=RED)
        watched_num.set_font("Inter")

        self.play(FadeIn(watched_label, run_time=0.7))
        self.play(FadeIn(watched_num, run_time=0.5))
        self.play(
            ChangeDecimalToValue(watched_num, 47, run_time=1.8),
            rate_func=rush_into,
        )
        self.wait(0.6)

        still = Text("Still stuck.", font="Inter", font_size=34, color=SUB)
        still.next_to(watched_num, DOWN, buff=0.5)
        self.play(FadeIn(still, run_time=0.8))
        self.wait(1.4)

        self.play(
            FadeOut(watched_label), FadeOut(watched_num),
            FadeOut(still), run_time=0.7,
        )
        self.wait(0.3)

        # ─── 5-8.5s: The problem ─────────────────────────────────────────
        lines = [
            "Watching ≠ doing.",
            "Reading ≠ understanding.",
            "Theory ≠ muscle memory.",
        ]
        items = VGroup(*[
            Text(line, font="Inter", font_size=26, color=SUB if i > 0 else TEXT, weight=BOLD if i == 0 else NORMAL)
            for i, line in enumerate(lines)
        ]).arrange(DOWN, buff=0.38, aligned_edge=LEFT)
        items.move_to(ORIGIN)

        for item in items:
            self.play(FadeIn(item, shift=RIGHT * 0.06, run_time=0.55))
        self.wait(1.3)

        self.play(FadeOut(items, run_time=0.8))
        self.wait(0.2)

        # ─── 8.5-12s: "What if you could just… do it?" ──────────────────
        q = Text("What if you could just", font="Inter", font_size=30, color=SUB)
        do_it = Text("do it?", font="Inter", font_size=52, color=TEXT, weight=BOLD)
        group = VGroup(q, do_it).arrange(DOWN, buff=0.3)
        self.play(FadeIn(q, run_time=0.8))
        self.play(FadeIn(do_it, shift=UP * 0.08, run_time=1.0))
        self.wait(1.8)

        self.play(FadeOut(q, run_time=0.5), FadeOut(do_it, run_time=0.5))
        self.wait(0.2)

        # ─── 12-16s: Terminal — learn by doing ──────────────────────────
        PANEL  = "#111111"
        HEADER = "#1a1a1a"

        term = RoundedRectangle(
            width=8.5, height=3.6, corner_radius=0.2,
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

        self.play(FadeIn(term, scale=0.96, run_time=1.0))
        self.play(FadeIn(hdr), FadeIn(dots), run_time=0.4)

        lines_data = [
            ("$ ", "#6b7280", "cat /etc/nginx/nginx.conf", "#60a5fa"),
            ("", "", "# nginx config loaded ✓", "#22c55e"),
            ("$ ", "#6b7280", "sudo nginx -t", "#60a5fa"),
            ("", "", "syntax is ok", "#22c55e"),
        ]
        y_start = hdr.get_bottom() + DOWN * 0.38
        row_group = VGroup()
        for i, (p, pc, cmd, cc) in enumerate(lines_data):
            row = VGroup(
                Text(p,   font="Consolas", font_size=15, color=pc),
                Text(cmd, font="Consolas", font_size=15, color=cc),
            ).arrange(RIGHT, buff=0.05)
            row.align_to(term, LEFT).shift(RIGHT * 0.35)
            row.move_to([row.get_center()[0], y_start[1] - i * 0.4, 0])
            row_group.add(row)
            self.play(Write(row, run_time=0.55))

        self.wait(0.7)
        self.play(FadeOut(term), FadeOut(hdr), FadeOut(dots), FadeOut(row_group), run_time=0.8)
        self.wait(0.2)

        # ─── 16-20s: WinLab tagline + CTA ────────────────────────────────
        tagline = Text("Real labs. Real commands.", font="Inter", font_size=32, color=TEXT, weight=BOLD)
        self.play(FadeIn(tagline, shift=UP * 0.08, run_time=1.1))
        self.wait(0.5)

        sub_tag = Text("No setup. No VM. Just open your browser.", font="Inter", font_size=19, color=SUB)
        sub_tag.next_to(tagline, DOWN, buff=0.42)
        self.play(FadeIn(sub_tag, run_time=0.9))
        self.wait(0.8)

        url = Text("winlab.cloud", font="Inter", font_size=26, color="#3b82f6", weight=BOLD)
        url.next_to(sub_tag, DOWN, buff=0.5)
        self.play(FadeIn(url, run_time=0.8))
        self.wait(2.0)

        self.play(FadeOut(tagline), FadeOut(sub_tag), FadeOut(url), run_time=0.9)


class WhyWinLabVertical(Scene):
    """9:16 vertical — same script, spacing adjusted"""
    def construct(self):
        config.frame_width  = 9
        config.frame_height = 16
        WhyWinLab.construct(self)
