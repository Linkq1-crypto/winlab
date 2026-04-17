"""
WinLab — Feature Showcase
===========================
"Type. Run. Learn."
Interactive terminal demo — shows what WinLab actually is.

Run:
  Horizontal: manim launch_feature.py FeatureShowcase -qh --format=mp4
  Vertical:   manim launch_feature.py FeatureShowcaseVertical -qh --format=mp4 -r 1080,1920
"""

from manim import *

config.background_color = "#0a0a0a"


class FeatureShowcase(Scene):
    def construct(self):
        TEXT  = "#e5e7eb"
        SUB   = "#6b7280"
        GREEN = "#22c55e"
        BLUE  = "#3b82f6"
        DIM   = "#374151"

        PANEL  = "#111111"
        HEADER = "#1a1a1a"

        # ─── 0-1.2s: Silence ────────────────────────────────────────────
        self.wait(1.2)

        # ─── 1.2-3s: "A real Linux lab. In your browser." ───────────────
        headline = Text("A real Linux lab.", font="Inter", font_size=36, color=TEXT, weight=BOLD)
        sub_hl   = Text("In your browser.", font="Inter", font_size=36, color=SUB,  weight=BOLD)
        header_group = VGroup(headline, sub_hl).arrange(DOWN, buff=0.22)
        header_group.shift(UP * 2.6)

        self.play(FadeIn(headline, shift=UP * 0.08, run_time=1.0))
        self.play(FadeIn(sub_hl,  shift=UP * 0.08, run_time=0.8))
        self.wait(0.6)

        # ─── 3-14s: Terminal window with live commands ────────────────────
        term = RoundedRectangle(
            width=9.0, height=5.0, corner_radius=0.2,
            fill_color=PANEL, fill_opacity=0.97,
            stroke_color="#222222", stroke_width=1,
        )
        term.shift(DOWN * 0.3)

        hdr = RoundedRectangle(
            width=9.0, height=0.44, corner_radius=0.2,
            fill_color=HEADER, fill_opacity=1, stroke_width=0,
        ).move_to(term.get_top() + DOWN * 0.20)

        dots = VGroup(*[
            Circle(radius=0.055, fill_color=c, fill_opacity=0.85)
            for c in ["#ff5f57", "#febc2e", "#28c840"]
        ]).arrange(RIGHT, buff=0.12).move_to(hdr).align_to(hdr, LEFT).shift(RIGHT * 0.22)

        title_bar = Text("WinLab — Linux Fundamentals · Lab 3", font="Consolas", font_size=11, color=DIM)
        title_bar.move_to(hdr)

        self.play(FadeIn(term, scale=0.96, run_time=1.0))
        self.play(FadeIn(hdr), FadeIn(dots), FadeIn(title_bar), run_time=0.35)

        # Progress bar at top of terminal
        prog_bg = RoundedRectangle(
            width=8.2, height=0.08, corner_radius=0.04,
            fill_color="#1f2937", fill_opacity=1, stroke_width=0,
        ).move_to(hdr.get_bottom() + DOWN * 0.12)
        prog_fill = RoundedRectangle(
            width=8.2 * 0.6, height=0.08, corner_radius=0.04,
            fill_color=GREEN, fill_opacity=0.7, stroke_width=0,
        ).align_to(prog_bg, LEFT)
        prog_label = Text("Lab progress  60%", font="Consolas", font_size=9, color=DIM)
        prog_label.next_to(prog_bg, RIGHT, buff=0.14)

        self.play(FadeIn(prog_bg), FadeIn(prog_fill), FadeIn(prog_label), run_time=0.4)

        # ── Commands sequence ──────────────────────────────────────────
        session = [
            # (prompt, prompt_color, command, cmd_color, output, out_color, pause)
            ("$ ", "#6b7280", "ls /etc/", "#60a5fa",
             "hosts  hostname  passwd  shadow  nginx/  ssh/  systemd/", "#e5e7eb", 0.5),
            ("$ ", "#6b7280", "cat /etc/hostname", "#60a5fa",
             "winlab-node-07", "#22c55e", 0.4),
            ("$ ", "#6b7280", "ps aux | grep nginx", "#60a5fa",
             "root   nginx: master process  ●  running", "#22c55e", 0.4),
            ("$ ", "#6b7280", "sudo systemctl restart nginx", "#60a5fa",
             "[ OK ] nginx restarted successfully", "#22c55e", 0.6),
        ]

        y_start = prog_bg.get_bottom() + DOWN * 0.30
        row_spacing = 0.56
        all_rows = VGroup()

        for i, (p, pc, cmd, cc, out, oc, pause) in enumerate(session):
            y = y_start[1] - i * row_spacing * 2

            cmd_row = VGroup(
                Text(p,   font="Consolas", font_size=14, color=pc),
                Text(cmd, font="Consolas", font_size=14, color=cc),
            ).arrange(RIGHT, buff=0.05)
            cmd_row.align_to(term, LEFT).shift(RIGHT * 0.32)
            cmd_row.move_to([cmd_row.get_center()[0], y, 0])

            out_row = Text(out, font="Consolas", font_size=13, color=oc)
            out_row.align_to(term, LEFT).shift(RIGHT * 0.32)
            out_row.move_to([out_row.get_center()[0], y - row_spacing * 0.78, 0])

            self.play(Write(cmd_row, run_time=0.65))
            self.play(FadeIn(out_row, run_time=0.4))
            self.wait(pause)
            all_rows.add(cmd_row, out_row)

        self.wait(0.5)

        # ─── 14-17s: Hint box — AI Mentor ────────────────────────────────
        hint_bg = RoundedRectangle(
            width=8.2, height=0.7, corner_radius=0.12,
            fill_color="#0f172a", fill_opacity=1,
            stroke_color="#1d4ed8", stroke_width=1,
        )
        hint_bg.move_to(term.get_bottom() + UP * 0.52)

        hint_icon = Text("⬡", font="Inter", font_size=16, color=BLUE)
        hint_icon.move_to(hint_bg).align_to(hint_bg, LEFT).shift(RIGHT * 0.3)

        hint_text = Text(
            "AI Mentor  →  'nginx -t checks config syntax without restarting'",
            font="Consolas", font_size=11, color="#93c5fd",
        )
        hint_text.next_to(hint_icon, RIGHT, buff=0.18)

        self.play(FadeIn(hint_bg, run_time=0.5))
        self.play(FadeIn(hint_icon), FadeIn(hint_text), run_time=0.5)
        self.wait(1.8)

        # ─── 17-21s: Fade terminal, show pill badges, CTA ────────────────
        self.play(
            FadeOut(term), FadeOut(hdr), FadeOut(dots), FadeOut(title_bar),
            FadeOut(prog_bg), FadeOut(prog_fill), FadeOut(prog_label),
            FadeOut(all_rows), FadeOut(hint_bg), FadeOut(hint_icon), FadeOut(hint_text),
            FadeOut(headline), FadeOut(sub_hl),
            run_time=0.9,
        )
        self.wait(0.2)

        # Badges: Linux / Jamf / Networking
        badge_data = [
            ("Linux", "#166534", "#22c55e"),
            ("Jamf",  "#1e3a5f", "#60a5fa"),
            ("Networking", "#3b1f6e", "#a78bfa"),
        ]
        badges = VGroup()
        for label, bg, fg in badge_data:
            pill_bg = RoundedRectangle(
                width=2.4, height=0.52, corner_radius=0.26,
                fill_color=bg, fill_opacity=1,
                stroke_color=fg, stroke_width=1,
            )
            pill_txt = Text(label, font="Inter", font_size=17, color=fg, weight=BOLD)
            pill_txt.move_to(pill_bg)
            badges.add(VGroup(pill_bg, pill_txt))
        badges.arrange(RIGHT, buff=0.4)
        badges.shift(UP * 0.5)

        self.play(LaggedStartMap(FadeIn, badges, lag_ratio=0.25, run_time=1.2))
        self.wait(0.4)

        cta_line = Text("Pre-launch Apr 17 · App live Apr 20.", font="Inter", font_size=22, color=TEXT)
        cta_line.next_to(badges, DOWN, buff=0.55)
        self.play(FadeIn(cta_line, run_time=0.8))
        self.wait(0.5)

        url = Text("winlab.cloud", font="Inter", font_size=30, color=BLUE, weight=BOLD)
        url.next_to(cta_line, DOWN, buff=0.42)
        self.play(FadeIn(url, shift=UP * 0.06, run_time=0.9))
        self.wait(2.2)

        self.play(
            FadeOut(badges), FadeOut(cta_line), FadeOut(url), run_time=0.9,
        )


class FeatureShowcaseVertical(Scene):
    """9:16 vertical — same script, spacing adjusted"""
    def construct(self):
        config.frame_width  = 9
        config.frame_height = 16
        FeatureShowcase.construct(self)
