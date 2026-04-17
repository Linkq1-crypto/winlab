"""
WinLab Hero Launch Video v2 — Emotional Story Arc
==================================================
Formula: Problem → Frustration → Injustice → Solution → CTA

Run:
  Horizontal (YouTube):  manim hero_video_v2.py HeroLaunch -qh --format=mp4
  Vertical (LinkedIn):   manim hero_video_v2.py HeroLaunchVertical -qh --format=mp4
"""

from manim import *

config.background_color = "#0a0a0a"


class HeroLaunch(Scene):
    def construct(self):
        # ─── Colors ─────────────────────────────────────────────────────
        ERROR = "#ef4444"
        SUCCESS = "#22c55e"
        WARNING = "#f59e00"
        ACCENT = "#3b82f6"
        TEXT = "#e5e7eb"
        SUB = "#9ca3af"
        PANEL = "#111111"
        HEADER = "#1e1e1e"

        # ─── 0-2s: HOOK — "Connection dropped." + glitch ────────────────
        hook = Text("Connection dropped.", font_size=52, color=ERROR, weight=BOLD)
        self.play(FadeIn(hook, shift=UP * 0.3), run_time=0.4)
        # Glitch effect
        self.play(hook.animate.shift(RIGHT * 0.15).set_opacity(0.7), run_time=0.05)
        self.play(hook.animate.shift(LEFT * 0.25).set_opacity(1), run_time=0.05)
        self.play(hook.animate.shift(RIGHT * 0.1), run_time=0.05)
        self.play(hook.animate.move_to([0, hook.get_center()[1], 0]), run_time=0.1)
        self.wait(0.8)
        self.play(FadeOut(hook), run_time=0.3)

        # ─── 2-5s: FRUSTRATION — terminal freeze + "Again." ─────────────
        terminal = RoundedRectangle(
            width=10, height=5, corner_radius=0.3,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#333333", stroke_width=2,
        ).to_edge(UP, buff=0.5)

        header_rect = RoundedRectangle(
            width=10, height=0.5, corner_radius=0.3,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(terminal.get_top() + DOWN * 0.22)

        dots = VGroup(*[
            Circle(radius=0.07, fill_color=c, fill_opacity=1)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.12).next_to(header_rect, LEFT, buff=0.3)

        self.play(FadeIn(terminal, scale=0.85), FadeIn(header_rect), FadeIn(dots), run_time=0.5)

        # Terminal lines with error
        err1 = Text("curl: (7) Failed to connect", font="Consolas", font_size=20, color=ERROR)
        err1.next_to(header_rect, DOWN, buff=0.5, aligned_edge=LEFT)
        err1.shift(RIGHT * 0.5)

        err2 = Text("Connection timed out", font="Consolas", font_size=20, color=ERROR)
        err2.next_to(err1, DOWN, buff=0.3, aligned_edge=LEFT)

        self.play(Write(err1), run_time=0.5)
        self.wait(0.3)
        self.play(Write(err2), run_time=0.5)

        # Loading spinner (frustration)
        spinner = Text("Loading...", font="Consolas", font_size=22, color=WARNING)
        spinner.next_to(err2, DOWN, buff=0.5, aligned_edge=LEFT)
        self.play(FadeIn(spinner), run_time=0.5)
        self.wait(1)

        # "Again."
        again = Text("Again.", font_size=42, color=SUB, weight=BOLD)
        again.to_edge(DOWN, buff=0.4)
        self.play(FadeIn(again, shift=UP * 0.2), run_time=0.5)
        self.wait(0.5)
        self.play(FadeOut(again), FadeOut(spinner), run_time=0.3)

        # ─── 5-8s: INJUSTICE — split screen ─────────────────────────────
        # Left: error (red)
        left_bg = Rectangle(
            width=5, height=3.5,
            fill_color="#1a0505", fill_opacity=0.8,
            stroke_width=0,
        ).shift(LEFT * 3 + UP * 0.3)

        left_x = Text("Connection refused", font="Consolas", font_size=18, color=ERROR)
        left_x.move_to(left_bg)
        left_label = Text("Without WinLab", font_size=20, color=SUB)
        left_label.next_to(left_bg, UP, buff=0.2)

        # Right: success (green)
        right_bg = Rectangle(
            width=5, height=3.5,
            fill_color="#051a0a", fill_opacity=0.8,
            stroke_width=0,
        ).shift(RIGHT * 3 + UP * 0.3)

        right_check = Text("Active: running", font="Consolas", font_size=18, color=SUCCESS)
        right_check.move_to(right_bg)
        right_label = Text("With WinLab", font_size=20, color=SUCCESS)
        right_label.next_to(right_bg, UP, buff=0.2)

        self.play(
            FadeOut(terminal), FadeOut(header_rect), FadeOut(dots),
            FadeOut(err1), FadeOut(err2),
        )

        self.play(
            FadeIn(left_bg), Write(left_x), Write(left_label),
            run_time=0.8,
        )
        self.play(
            FadeIn(right_bg), Write(right_check), Write(right_label),
            run_time=0.8,
        )
        self.wait(0.3)

        # "Same skills. Different outcome."
        injustice = Text("Same skills. Different outcome.", font_size=32, color=WHITE, weight=BOLD)
        injustice.to_edge(DOWN, buff=0.3)
        self.play(FadeIn(injustice, shift=UP * 0.2), run_time=0.6)
        self.wait(1)

        # ─── 8-12s: SHIFT — "Not because of talent." → "Because of internet." ─
        self.play(FadeOut(left_bg), FadeOut(right_bg), FadeOut(left_x), FadeOut(right_check),
                  FadeOut(left_label), FadeOut(right_label), FadeOut(injustice))

        shift1 = Text("Not because of talent.", font_size=38, color=TEXT, weight=BOLD)
        shift1.shift(UP * 0.5)
        self.play(Write(shift1, run_time=1))
        self.wait(0.5)
        self.play(FadeOut(shift1), run_time=0.5)

        # ⚡ PAUSE 0.5s
        self.wait(0.5)

        shift2 = Text("Because of internet.", font_size=42, color=WARNING, weight=BOLD)
        shift2.shift(UP * 0.3)
        self.play(Write(shift2, run_time=0.8))
        self.wait(1.5)
        self.play(FadeOut(shift2), run_time=0.5)

        # ─── 12-18s: SOLUTION — fast terminal fix ───────────────────────
        term2 = RoundedRectangle(
            width=10, height=4.5, corner_radius=0.3,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#333333", stroke_width=2,
        ).shift(UP * 0.8)

        hdr2 = RoundedRectangle(
            width=10, height=0.5, corner_radius=0.3,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(term2.get_top() + DOWN * 0.22)

        dots2 = VGroup(*[
            Circle(radius=0.07, fill_color=c, fill_opacity=1)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.12).next_to(hdr2, LEFT, buff=0.3)

        self.play(FadeIn(term2), FadeIn(hdr2), FadeIn(dots2), run_time=0.5)

        cmd1 = Text("$ sudo systemctl restart apache2", font="Consolas", font_size=20, color="#60a5fa")
        cmd1.next_to(hdr2, DOWN, buff=0.5, aligned_edge=LEFT).shift(RIGHT * 0.5)
        self.play(Write(cmd1), run_time=0.6)

        ok1 = Text("Started apache2.service", font="Consolas", font_size=18, color=SUCCESS)
        ok1.next_to(cmd1, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(Write(ok1), run_time=0.5)

        ok2 = Text("Active: running", font="Consolas", font_size=18, color=SUCCESS, weight=BOLD)
        ok2.next_to(ok1, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(Write(ok2), run_time=0.5)

        # Overlay bullets
        sol1 = Text("Works offline", font_size=24, color=SUCCESS)
        sol1.to_edge(DOWN, buff=1.2)
        sol2 = Text("Works on GSM", font_size=24, color=SUCCESS)
        sol2.next_to(sol1, DOWN, buff=0.25)

        self.play(Write(sol1), run_time=0.3)
        self.play(Write(sol2), run_time=0.3)
        self.wait(0.5)

        # ─── 18-22s: CLOSING + CTA ──────────────────────────────────────
        closing = Text("Same lab. Same chance.", font_size=42, color=WHITE, weight=BOLD)
        closing.shift(UP * 0.3)
        cta = Text("WinLab.cloud", font_size=52, color=ACCENT, weight=BOLD)
        cta.next_to(closing, DOWN, buff=0.5)

        self.play(
            FadeOut(term2), FadeOut(hdr2), FadeOut(dots2),
            FadeOut(cmd1), FadeOut(ok1), FadeOut(ok2),
            FadeOut(sol1), FadeOut(sol2),
        )

        self.play(FadeIn(closing, shift=UP * 0.2), run_time=0.8)
        self.play(FadeIn(cta, shift=UP * 0.2), run_time=0.8)
        self.wait(2)

        self.play(FadeOut(closing), FadeOut(cta), run_time=1)
        self.wait(0.3)


# ══════════════════════════════════════════════════════════════════════
# VERTICAL VERSION (9:16 for LinkedIn / Instagram / TikTok)
# Run: manim hero_video_v2.py HeroLaunchVertical -qh --format=mp4
# ══════════════════════════════════════════════════════════════════════

class HeroLaunchVertical(Scene):
    def construct(self):
        ERROR = "#ef4444"
        SUCCESS = "#22c55e"
        WARNING = "#f59e00"
        ACCENT = "#3b82f6"
        TEXT = "#e5e7eb"
        SUB = "#9ca3af"
        PANEL = "#111111"
        HEADER = "#1e1e1e"

        # ─── 0-2s: HOOK ─────────────────────────────────────────────────
        hook = Text("Connection dropped.", font_size=40, color=ERROR, weight=BOLD)
        hook.to_edge(UP, buff=1)
        self.play(FadeIn(hook, shift=UP * 0.3), run_time=0.4)
        # Glitch
        self.play(hook.animate.shift(RIGHT * 0.15).set_opacity(0.7), run_time=0.05)
        self.play(hook.animate.shift(LEFT * 0.25).set_opacity(1), run_time=0.05)
        self.play(hook.animate.shift(RIGHT * 0.1), run_time=0.05)
        self.play(hook.animate.move_to([0, hook.get_center()[1], 0]), run_time=0.1)
        self.wait(0.8)
        self.play(FadeOut(hook), run_time=0.3)

        # ─── 2-5s: FRUSTRATION ──────────────────────────────────────────
        terminal = RoundedRectangle(
            width=6.5, height=4, corner_radius=0.25,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#333333", stroke_width=2,
        ).shift(UP * 0.5)

        hdr = RoundedRectangle(
            width=6.5, height=0.45, corner_radius=0.25,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(terminal.get_top() + DOWN * 0.2)

        dots = VGroup(*[
            Circle(radius=0.06, fill_color=c, fill_opacity=1)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.1).next_to(hdr, LEFT, buff=0.25)

        self.play(FadeIn(terminal), FadeIn(hdr), FadeIn(dots), run_time=0.5)

        err1 = Text("Connection timed out", font="Consolas", font_size=16, color=ERROR)
        err1.next_to(hdr, DOWN, buff=0.4, aligned_edge=LEFT).shift(RIGHT * 0.3)
        err2 = Text("Cannot reach server", font="Consolas", font_size=16, color=ERROR)
        err2.next_to(err1, DOWN, buff=0.25, aligned_edge=LEFT)

        self.play(Write(err1), run_time=0.5)
        self.wait(0.3)
        self.play(Write(err2), run_time=0.5)

        spinner = Text("Loading...", font="Consolas", font_size=18, color=WARNING)
        spinner.next_to(err2, DOWN, buff=0.4, aligned_edge=LEFT)
        self.play(FadeIn(spinner), run_time=0.4)
        self.wait(0.8)

        again = Text("Again.", font_size=34, color=SUB, weight=BOLD)
        again.to_edge(DOWN, buff=1)
        self.play(FadeIn(again, shift=UP * 0.2), run_time=0.4)
        self.wait(0.5)
        self.play(FadeOut(again), FadeOut(spinner), run_time=0.3)

        # ─── 5-8s: INJUSTICE ────────────────────────────────────────────
        self.play(FadeOut(terminal), FadeOut(hdr), FadeOut(dots), FadeOut(err1), FadeOut(err2))

        # Stacked instead of side-by-side (vertical layout)
        box1 = RoundedRectangle(
            width=6.5, height=1.2, corner_radius=0.2,
            fill_color="#1a0505", fill_opacity=0.8, stroke_width=0,
        ).shift(UP * 1.5)
        x1 = Text("Without WinLab", font_size=20, color=SUB)
        x1.next_to(box1, UP, buff=0.15)
        err_text = Text("Connection refused", font="Consolas", font_size=16, color=ERROR)
        err_text.move_to(box1)

        box2 = RoundedRectangle(
            width=6.5, height=1.2, corner_radius=0.2,
            fill_color="#051a0a", fill_opacity=0.8, stroke_width=0,
        ).shift(UP * 0.1)
        ok_label = Text("With WinLab", font_size=20, color=SUCCESS)
        ok_label.next_to(box2, UP, buff=0.15)
        ok_text = Text("Active: running", font="Consolas", font_size=16, color=SUCCESS)
        ok_text.move_to(box2)

        self.play(FadeIn(box1), Write(x1), Write(err_text), run_time=0.6)
        self.play(FadeIn(box2), Write(ok_label), Write(ok_text), run_time=0.6)

        injustice = Text("Same skills.", font_size=28, color=TEXT, weight=BOLD)
        injustice.to_edge(DOWN, buff=1)
        self.play(FadeIn(injustice, shift=UP * 0.2), run_time=0.5)
        self.wait(0.5)

        injustice2 = Text("Different outcome.", font_size=32, color=SUCCESS, weight=BOLD)
        injustice2.next_to(injustice, DOWN, buff=0.15)
        self.play(FadeIn(injustice2, shift=UP * 0.2), run_time=0.5)
        self.wait(0.5)

        self.play(
            FadeOut(box1), FadeOut(box2), FadeOut(x1), FadeOut(ok_label),
            FadeOut(err_text), FadeOut(ok_text),
            FadeOut(injustice), FadeOut(injustice2),
        )

        # ─── 8-12s: SHIFT ───────────────────────────────────────────────
        shift1 = Text("Not because of talent.", font_size=30, color=TEXT, weight=BOLD)
        shift1.shift(UP * 0.8)
        self.play(Write(shift1, run_time=0.8))
        self.wait(0.5)
        self.play(FadeOut(shift1), run_time=0.5)

        self.wait(0.5)  # ⚡ pause

        shift2 = Text("Because of internet.", font_size=34, color=WARNING, weight=BOLD)
        shift2.shift(UP * 0.5)
        self.play(Write(shift2, run_time=0.8))
        self.wait(1.5)
        self.play(FadeOut(shift2), run_time=0.5)

        # ─── 12-18s: SOLUTION ───────────────────────────────────────────
        term2 = RoundedRectangle(
            width=6.5, height=3.5, corner_radius=0.25,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#333333", stroke_width=2,
        ).shift(UP * 0.8)

        hdr2 = RoundedRectangle(
            width=6.5, height=0.45, corner_radius=0.25,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(term2.get_top() + DOWN * 0.2)

        dots2 = VGroup(*[
            Circle(radius=0.06, fill_color=c, fill_opacity=1)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.1).next_to(hdr2, LEFT, buff=0.25)

        self.play(FadeIn(term2), FadeIn(hdr2), FadeIn(dots2), run_time=0.5)

        cmd1 = Text("$ sudo systemctl", font="Consolas", font_size=16, color="#60a5fa")
        cmd1.next_to(hdr2, DOWN, buff=0.4, aligned_edge=LEFT).shift(RIGHT * 0.3)
        cmd1b = Text("restart apache2", font="Consolas", font_size=16, color="#60a5fa")
        cmd1b.next_to(cmd1, DOWN, buff=0.15, aligned_edge=LEFT)
        self.play(Write(cmd1), Write(cmd1b), run_time=0.5)

        ok1 = Text("Started apache2", font="Consolas", font_size=14, color=SUCCESS)
        ok1.next_to(cmd1b, DOWN, buff=0.25, aligned_edge=LEFT)
        self.play(Write(ok1), run_time=0.4)

        ok2 = Text("Active: running", font="Consolas", font_size=14, color=SUCCESS, weight=BOLD)
        ok2.next_to(ok1, DOWN, buff=0.2, aligned_edge=LEFT)
        self.play(Write(ok2), run_time=0.4)

        sol1 = Text("Works offline", font_size=20, color=SUCCESS)
        sol1.to_edge(DOWN, buff=1.5)
        sol2 = Text("Works on GSM", font_size=20, color=SUCCESS)
        sol2.next_to(sol1, DOWN, buff=0.2)

        self.play(Write(sol1), run_time=0.3)
        self.play(Write(sol2), run_time=0.3)
        self.wait(0.5)

        # ─── 18-22s: CLOSING + CTA ──────────────────────────────────────
        self.play(
            FadeOut(term2), FadeOut(hdr2), FadeOut(dots2),
            FadeOut(cmd1), FadeOut(cmd1b), FadeOut(ok1), FadeOut(ok2),
            FadeOut(sol1), FadeOut(sol2),
        )

        closing = Text("Same lab. Same chance.", font_size=32, color=WHITE, weight=BOLD)
        closing.shift(UP * 0.5)
        cta = Text("WinLab.cloud", font_size=42, color=ACCENT, weight=BOLD)
        cta.next_to(closing, DOWN, buff=0.4)

        self.play(FadeIn(closing, shift=UP * 0.2), run_time=0.7)
        self.play(FadeIn(cta, shift=UP * 0.2), run_time=0.7)
        self.wait(2)

        self.play(FadeOut(closing), FadeOut(cta), run_time=1)
        self.wait(0.3)
