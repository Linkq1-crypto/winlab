"""
WinLab Hero Launch Video - Manim
=================================
25-second video: "Same skills. Different outcome."

Run:
  Horizontal (YouTube):  manim hero_video.py HeroLaunch -qh --format=mp4
  Vertical (LinkedIn):   manim hero_video.py HeroLaunchVertical -qh --format=mp4

Quality options:
  -ql  = 480p (fast, for testing)
  -qm  = 720p (for YouTube)
  -qh  = 1080p (high quality)
"""

from manim import *
import numpy as np

config.background_color = "#0a0a0a"

class HeroLaunch(Scene):
    def construct(self):
        # ─── Colors ─────────────────────────────────────────────────────
        BG = "#0a0a0a"
        PANEL = "#111111"
        HEADER = "#1e1e1e"
        TEXT = "#e5e7eb"
        SUB = "#9ca3af"
        ACCENT = "#3b82f6"
        SUCCESS = "#22c55e"
        ERROR = "#ef4444"
        WARNING = "#f59e0b"

        # ─── Terminal Window ────────────────────────────────────────────
        terminal = RoundedRectangle(
            width=11, height=6.2, corner_radius=0.3,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#333333", stroke_width=2
        ).to_edge(UP, buff=0.5)

        header = RoundedRectangle(
            width=11, height=0.6, corner_radius=0.3,
            fill_color=HEADER, fill_opacity=1,
            stroke_width=0
        ).next_to(terminal, UP, buff=-0.28)

        # Traffic lights
        dots = VGroup(*[
            Circle(radius=0.08, fill_color=c, fill_opacity=1)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.15).next_to(header, LEFT, buff=0.3)

        # Title
        title = Text("winlab — terminal", font="Consolas", font_size=14, color=SUB)
        title.next_to(header, RIGHT, buff=1.5)

        # Terminal body
        body = RoundedRectangle(
            width=10.6, height=5.4, corner_radius=0.2,
            fill_color="#000000", fill_opacity=0.4,
            stroke_width=0
        ).next_to(header, DOWN, buff=0.05)

        # ─── Animate terminal appearance (0-1s) ─────────────────────────
        self.play(
            FadeIn(terminal, scale=0.9),
            FadeIn(header),
            FadeIn(dots),
            FadeIn(title),
            FadeIn(body),
            run_time=1,
        )

        # ─── HOOK (0-3s): "Same skills. Different outcome." ────────────
        hook = Text(
            "Same skills. Different outcome.",
            font_size=42, color=WHITE, weight=BOLD
        ).to_edge(UP, buff=0.15)

        self.play(Write(hook), run_time=1.5)
        self.wait(1)
        self.play(FadeOut(hook), run_time=0.5)

        # ─── Command 1: curl (3s) ──────────────────────────────────────
        lines = VGroup()
        y_pos = 2.0

        cmd1 = Text("$ curl -I localhost", font="Consolas", font_size=20, color="#60a5fa")
        cmd1.move_to(body.get_top() + DOWN * 0.5 + RIGHT * 0.3)
        self.play(Write(cmd1), run_time=0.8)
        lines.add(cmd1)

        # Error (4s)
        err1 = Text("curl: (7) Failed to connect", font="Consolas", font_size=18, color=ERROR)
        err1.next_to(cmd1, DOWN, buff=0.3, aligned_edge=LEFT)
        err2 = Text("Connection refused", font="Consolas", font_size=18, color=ERROR)
        err2.next_to(err1, DOWN, buff=0.2, aligned_edge=LEFT)

        self.play(Write(err1), run_time=0.5)
        self.wait(0.5)
        self.play(Write(err2), run_time=0.5)
        lines.add(err1, err2)

        # ─── PROBLEM (3-8s): "Connection dropped." ─────────────────────
        problem = Text(
            "Connection dropped.",
            font_size=36, color=ERROR
        ).to_edge(DOWN, buff=0.3)

        self.play(Write(problem), run_time=0.5)
        self.wait(1.5)
        self.play(FadeOut(problem), run_time=0.3)

        # ─── Command 2: systemctl (8s) ─────────────────────────────────
        cmd2 = Text("$ systemctl status httpd", font="Consolas", font_size=20, color="#60a5fa")
        cmd2.next_to(err2, DOWN, buff=0.5, aligned_edge=LEFT)
        self.play(Write(cmd2), run_time=0.8)

        status = Text("   Active: inactive (dead)", font="Consolas", font_size=18, color=ERROR)
        status.next_to(cmd2, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(Write(status), run_time=0.5)

        # ─── INSIGHT (8-12s): "Because of a SIM card." ─────────────────
        insight = Text(
            "Because of a SIM card.",
            font_size=38, color=WARNING, weight=BOLD
        ).move_to(ORIGIN)

        self.play(Write(insight), run_time=1)
        self.wait(1.5)
        self.play(FadeOut(insight, scale=0.8), run_time=0.5)

        # ─── Command 3: Fix (12s) ──────────────────────────────────────
        cmd3 = Text("$ sudo systemctl start httpd", font="Consolas", font_size=20, color="#60a5fa")
        cmd3.next_to(status, DOWN, buff=0.5, aligned_edge=LEFT)
        self.play(Write(cmd3), run_time=0.8)

        ok1 = Text("Started httpd.service", font="Consolas", font_size=18, color=SUCCESS)
        ok1.next_to(cmd3, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(Write(ok1), run_time=0.5)

        # Solution overlays (12-20s)
        sol1 = Text("Works on GSM", font_size=24, color=SUCCESS)
        sol1.to_edge(DOWN, buff=0.8).shift(LEFT * 3)
        sol2 = Text("Works offline", font_size=24, color=SUCCESS)
        sol2.next_to(sol1, DOWN, buff=0.3)
        sol3 = Text("Works anywhere", font_size=24, color=SUCCESS)
        sol3.next_to(sol2, DOWN, buff=0.3)

        self.play(Write(sol1), run_time=0.4)
        self.wait(0.3)
        self.play(Write(sol2), run_time=0.4)
        self.wait(0.3)
        self.play(Write(sol3), run_time=0.4)

        # ─── Verify (15s) ──────────────────────────────────────────────
        cmd4 = Text("$ curl localhost", font="Consolas", font_size=20, color="#60a5fa")
        cmd4.next_to(ok1, DOWN, buff=0.5, aligned_edge=LEFT)
        self.play(Write(cmd4), run_time=0.8)

        ok2 = Text("HTTP/1.1 200 OK", font="Consolas", font_size=18, color=SUCCESS)
        ok2.next_to(cmd4, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(Write(ok2), run_time=0.5)

        ok3 = Text("   Active: running", font="Consolas", font_size=18, color=SUCCESS)
        ok3.next_to(ok2, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(Write(ok3), run_time=0.5)

        ok4 = Text("OK Scenario resolved", font="Consolas", font_size=18, color=SUCCESS, weight=BOLD)
        ok4.next_to(ok3, DOWN, buff=0.5, aligned_edge=LEFT)
        self.play(Write(ok4), run_time=0.5)

        # ─── CLOSING (20-25s) ──────────────────────────────────────────
        closing = Text(
            "Same lab. Same chance.",
            font_size=40, color=WHITE, weight=BOLD
        ).move_to(ORIGIN + UP * 0.5)

        cta = Text(
            "WinLab.cloud",
            font_size=52, color=ACCENT, weight=BOLD
        ).next_to(closing, DOWN, buff=0.5)

        self.play(
            FadeIn(closing, shift=UP * 0.3),
            run_time=1
        )
        self.wait(0.5)
        self.play(
            FadeIn(cta, shift=UP * 0.3),
            run_time=1
        )
        self.wait(2)

        # ─── Fade out ──────────────────────────────────────────────────
        self.play(
            FadeOut(closing, scale=0.8),
            FadeOut(cta, scale=0.8),
            run_time=1.5
        )
        self.wait(0.5)


# ══════════════════════════════════════════════════════════════════════
# VERTICAL VERSION (9:16 for LinkedIn / Instagram / TikTok)
# Run: manim hero_video.py HeroLaunchVertical -qh --format=mp4
# ══════════════════════════════════════════════════════════════════════

class HeroLaunchVertical(Scene):
    def construct(self):
        # ─── Colors ─────────────────────────────────────────────────────
        TEXT = "#e5e7eb"
        SUB = "#9ca3af"
        ACCENT = "#3b82f6"
        SUCCESS = "#22c55e"
        ERROR = "#ef4444"
        WARNING = "#f59e0b"
        PANEL = "#111111"
        HEADER = "#1e1e1e"

        # ─── Terminal Window (narrower for vertical) ────────────────────
        terminal = RoundedRectangle(
            width=6.5, height=5.0, corner_radius=0.25,
            fill_color=PANEL, fill_opacity=0.95,
            stroke_color="#333333", stroke_width=2
        ).shift(UP * 0.3)

        header = RoundedRectangle(
            width=6.5, height=0.5, corner_radius=0.25,
            fill_color=HEADER, fill_opacity=1, stroke_width=0
        ).move_to(terminal.get_top() + DOWN * 0.23)

        # Traffic lights
        dots = VGroup(*[
            Circle(radius=0.06, fill_color=c, fill_opacity=1)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.12).next_to(header, LEFT, buff=0.3)

        title = Text("winlab — terminal", font="Consolas", font_size=12, color=SUB)
        title.move_to(header)

        body = RoundedRectangle(
            width=6.2, height=4.3, corner_radius=0.15,
            fill_color="#000000", fill_opacity=0.4, stroke_width=0
        ).next_to(header, DOWN, buff=0.03)

        # ─── Animate terminal appearance (0-1s) ─────────────────────────
        self.play(
            FadeIn(terminal, scale=0.9),
            FadeIn(header), FadeIn(dots), FadeIn(title), FadeIn(body),
            run_time=1,
        )

        # ─── HOOK (0-3s) ────────────────────────────────────────────────
        hook = Text(
            "Same skills.\nDifferent outcome.",
            font_size=36, color=WHITE, weight=BOLD
        ).to_edge(UP, buff=0.3)

        self.play(Write(hook, run_time=1))
        self.wait(1.5)
        self.play(FadeOut(hook, run_time=0.5))

        # ─── Commands ───────────────────────────────────────────────────
        cmd1 = Text("$ curl -I localhost", font="Consolas", font_size=16, color="#60a5fa")
        cmd1.move_to(body.get_top() + DOWN * 0.4 + RIGHT * 0.2)
        self.play(Write(cmd1), run_time=0.6)

        err1 = Text("curl: (7) Failed to connect", font="Consolas", font_size=14, color=ERROR)
        err1.next_to(cmd1, DOWN, buff=0.25, aligned_edge=LEFT)
        err2 = Text("Connection refused", font="Consolas", font_size=14, color=ERROR)
        err2.next_to(err1, DOWN, buff=0.15, aligned_edge=LEFT)

        self.play(Write(err1), run_time=0.4)
        self.play(Write(err2), run_time=0.4)

        # ─── PROBLEM text ───────────────────────────────────────────────
        problem = Text("Connection dropped.", font_size=28, color=ERROR)
        problem.to_edge(DOWN, buff=0.5)
        self.play(Write(problem), run_time=0.5)
        self.wait(1)
        self.play(FadeOut(problem, run_time=0.3))

        # ─── Command 2 ──────────────────────────────────────────────────
        cmd2 = Text("$ systemctl status httpd", font="Consolas", font_size=16, color="#60a5fa")
        cmd2.next_to(err2, DOWN, buff=0.4, aligned_edge=LEFT)
        self.play(Write(cmd2), run_time=0.6)

        status = Text("   Active: inactive (dead)", font="Consolas", font_size=14, color=ERROR)
        status.next_to(cmd2, DOWN, buff=0.2, aligned_edge=LEFT)
        self.play(Write(status), run_time=0.4)

        # ─── INSIGHT ────────────────────────────────────────────────────
        insight = Text("Because of a SIM card.", font_size=32, color=WARNING, weight=BOLD)
        insight.to_edge(DOWN, buff=0.5)
        self.play(Write(insight), run_time=0.8)
        self.wait(1.5)
        self.play(FadeOut(insight, run_time=0.4))

        # ─── Fix ────────────────────────────────────────────────────────
        cmd3 = Text("$ sudo systemctl start httpd", font="Consolas", font_size=16, color="#60a5fa")
        cmd3.next_to(status, DOWN, buff=0.4, aligned_edge=LEFT)
        self.play(Write(cmd3), run_time=0.6)

        ok1 = Text("Started httpd.service", font="Consolas", font_size=14, color=SUCCESS)
        ok1.next_to(cmd3, DOWN, buff=0.2, aligned_edge=LEFT)
        self.play(Write(ok1), run_time=0.4)

        # Solution overlays - stacked vertically
        sol1 = Text("Works on GSM", font_size=22, color=SUCCESS)
        sol1.to_edge(DOWN, buff=1.2)
        sol2 = Text("Works offline", font_size=22, color=SUCCESS)
        sol2.next_to(sol1, DOWN, buff=0.25)
        sol3 = Text("Works anywhere", font_size=22, color=SUCCESS)
        sol3.next_to(sol2, DOWN, buff=0.25)

        self.play(Write(sol1), run_time=0.3)
        self.play(Write(sol2), run_time=0.3)
        self.play(Write(sol3), run_time=0.3)

        # ─── Verify ─────────────────────────────────────────────────────
        cmd4 = Text("$ curl localhost", font="Consolas", font_size=16, color="#60a5fa")
        cmd4.next_to(ok1, DOWN, buff=0.35, aligned_edge=LEFT)
        self.play(Write(cmd4), run_time=0.6)

        ok2 = Text("HTTP/1.1 200 OK", font="Consolas", font_size=14, color=SUCCESS)
        ok2.next_to(cmd4, DOWN, buff=0.2, aligned_edge=LEFT)
        self.play(Write(ok2), run_time=0.4)

        ok3 = Text("OK Scenario resolved", font="Consolas", font_size=14, color=SUCCESS, weight=BOLD)
        ok3.next_to(ok2, DOWN, buff=0.3, aligned_edge=LEFT)
        self.play(Write(ok3), run_time=0.4)

        # ─── CLOSING ────────────────────────────────────────────────────
        closing = Text("Same lab. Same chance.", font_size=34, color=WHITE, weight=BOLD)
        closing.to_edge(DOWN, buff=1.5)

        cta = Text("WinLab.cloud", font_size=42, color=ACCENT, weight=BOLD)
        cta.next_to(closing, DOWN, buff=0.4)

        self.play(FadeIn(closing, shift=UP * 0.2), run_time=0.8)
        self.play(FadeIn(cta, shift=UP * 0.2), run_time=0.8)
        self.wait(2.5)

        self.play(
            FadeOut(closing, scale=0.8),
            FadeOut(cta, scale=0.8),
            run_time=1
        )
        self.wait(0.5)
