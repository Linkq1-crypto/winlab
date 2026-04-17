"""
WinLab — Early Access Urgency
==============================
"500 seats. $5/mo. Yours forever."
Urgency/scarcity video for launch week.

Run:
  Horizontal: manim launch_early_access.py EarlyAccess -qh --format=mp4
  Vertical:   manim launch_early_access.py EarlyAccessVertical -qh --format=mp4 -r 1080,1920
"""

from manim import *

config.background_color = "#0a0a0a"


class EarlyAccess(Scene):
    def construct(self):
        TEXT   = "#e5e7eb"
        SUB    = "#6b7280"
        GREEN  = "#22c55e"
        YELLOW = "#facc15"
        DIM    = "#374151"
        RED    = "#ef4444"

        # ─── 0-1.5s: Silence ────────────────────────────────────────────
        self.wait(1.5)

        # ─── 1.5-5s: "500 seats." alone, large ─────────────────────────
        seats = Text("500 seats.", font="Inter", font_size=64, color=TEXT, weight=BOLD)
        self.play(FadeIn(seats, shift=UP * 0.1, run_time=1.2))
        self.wait(1.0)

        sub1 = Text("Early access. First in, locked forever.", font="Inter", font_size=20, color=SUB)
        sub1.next_to(seats, DOWN, buff=0.45)
        self.play(FadeIn(sub1, run_time=0.9))
        self.wait(1.2)

        self.play(FadeOut(seats, run_time=0.6), FadeOut(sub1, run_time=0.6))
        self.wait(0.3)

        # ─── 5-10s: Seat counter filling ────────────────────────────────
        label = Text("seats claimed", font="Inter", font_size=16, color=SUB)
        label.shift(UP * 0.9)

        bar_bg = RoundedRectangle(
            width=7, height=0.28, corner_radius=0.14,
            fill_color="#1f2937", fill_opacity=1,
            stroke_color="#374151", stroke_width=1,
        )
        bar_bg.shift(UP * 0.2)

        # filled bar — starts narrow, grows
        bar_fill = RoundedRectangle(
            width=0.01, height=0.28, corner_radius=0.14,
            fill_color=GREEN, fill_opacity=1, stroke_width=0,
        )
        bar_fill.align_to(bar_bg, LEFT)
        bar_fill.shift(UP * 0.2)

        count_num = Integer(0, font_size=52, color=GREEN)
        count_num.set_font("Inter")
        count_num.shift(DOWN * 0.55)

        slash = Text("/ 500", font="Inter", font_size=28, color=DIM)
        slash.next_to(count_num, RIGHT, buff=0.12).align_to(count_num, DOWN)

        self.play(
            FadeIn(label, run_time=0.6),
            FadeIn(bar_bg, run_time=0.6),
            FadeIn(count_num, run_time=0.6),
            FadeIn(slash, run_time=0.6),
        )

        # Animate counter 0 → 347 with bar
        target = 347
        bar_target_width = 7 * (target / 500)

        self.play(
            ChangeDecimalToValue(count_num, target, run_time=2.8),
            bar_fill.animate(run_time=2.8).set(width=bar_target_width).align_to(bar_bg, LEFT).shift(UP * 0.2),
            rate_func=rush_into,
        )

        # Flash remaining seats warning
        remaining = Text(f"{500 - target} left", font="Inter", font_size=19, color=YELLOW, weight=BOLD)
        remaining.next_to(bar_bg, RIGHT, buff=0.22).align_to(bar_bg, DOWN)
        self.play(FadeIn(remaining, run_time=0.5))
        self.wait(1.2)

        self.play(
            FadeOut(label), FadeOut(bar_bg), FadeOut(bar_fill),
            FadeOut(count_num), FadeOut(slash), FadeOut(remaining),
            run_time=0.7,
        )
        self.wait(0.2)

        # ─── 10-14s: Price reveal ────────────────────────────────────────
        price_label = Text("Early access price", font="Inter", font_size=17, color=SUB)
        price_label.shift(UP * 1.1)

        price = Text("$5", font="Inter", font_size=96, color=GREEN, weight=BOLD)

        price_sub = Text("/ month", font="Inter", font_size=24, color=SUB)
        price_sub.next_to(price, RIGHT, buff=0.18).align_to(price, DOWN).shift(UP * 0.22)

        lock = Text("Locked forever.", font="Inter", font_size=20, color=TEXT)
        lock.next_to(price, DOWN, buff=0.5)

        future = Text("Future price: $19/mo", font="Inter", font_size=15, color=DIM)
        future.next_to(lock, DOWN, buff=0.25)

        self.play(FadeIn(price_label, run_time=0.5))
        self.play(FadeIn(price, scale=0.88, run_time=1.0))
        self.play(FadeIn(price_sub, run_time=0.5), FadeIn(lock, run_time=0.5))
        self.wait(0.6)
        self.play(FadeIn(future, run_time=0.6))
        self.wait(1.4)

        self.play(
            FadeOut(price_label), FadeOut(price), FadeOut(price_sub),
            FadeOut(lock), FadeOut(future), run_time=0.8,
        )
        self.wait(0.2)

        # ─── 14-18s: CTA ────────────────────────────────────────────────
        now = Text("Claim your seat now.", font="Inter", font_size=38, color=TEXT, weight=BOLD)
        self.play(FadeIn(now, shift=UP * 0.1, run_time=1.1))
        self.wait(0.6)

        url = Text("winlab.cloud", font="Inter", font_size=28, color="#3b82f6", weight=BOLD)
        url.next_to(now, DOWN, buff=0.5)
        self.play(FadeIn(url, run_time=0.9))
        self.wait(2.2)

        self.play(FadeOut(now, run_time=0.8), FadeOut(url, run_time=0.8))


class EarlyAccessVertical(Scene):
    """9:16 vertical — same script, spacing adjusted"""
    def construct(self):
        config.frame_width  = 9
        config.frame_height = 16
        EarlyAccess.construct(self)
