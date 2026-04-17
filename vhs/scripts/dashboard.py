"""
WinLab Content Dashboard — Streamlit
=====================================
Live insights: top hooks, cluster performance, video rankings.

Usage:
  streamlit run vhs/scripts/dashboard.py
"""

import os
import json
import pandas as pd
import streamlit as st

# ═══════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════

@st.cache_data
def load_data():
    """Load performance data from JSON."""
    data_path = "data/performance.json"
    if os.path.exists(data_path):
        with open(data_path) as f:
            return json.load(f)
    # Demo data
    return []


def compute_score(row):
    views = max(row.get("views", 1), 1)
    clicks = row.get("clicks", 0)
    signups = row.get("signups", 0)
    comments = row.get("comments", 0)
    ctr = clicks / views
    cr = signups / max(clicks, 1)
    engagement = comments / views
    return ctr * 0.4 + cr * 0.4 + engagement * 0.2


def load_generated_videos():
    """Load generated video manifests."""
    manifest = "vhs/output/manifest.json"
    if os.path.exists(manifest):
        with open(manifest) as f:
            return json.load(f)
    return []


def load_landings():
    """Load landing page mappings."""
    path = "vhs/output/landings.json"
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []


# ═══════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════

st.set_page_config(page_title="WinLab Content Engine", layout="wide")
st.title("🎬 WinLab Content Engine")
st.caption("Live insights • Hook performance • Video ranking")

data = load_data()
videos = load_generated_videos()
landings = load_landings()

# ─── Metrics ──────────────────────────────────────────────────
col1, col2, col3, col4 = st.columns(4)

total_videos = len(videos) if videos else 12  # from existing templates
total_views = sum(d.get("views", 0) for d in data) if data else 0
total_clicks = sum(d.get("clicks", 0) for d in data) if data else 0
avg_ctr = (total_clicks / max(total_views, 1)) * 100

col1.metric("Videos Generated", total_videos)
col2.metric("Total Views", f"{total_views:,}")
col3.metric("Total Clicks", f"{total_clicks:,}")
col4.metric("Avg CTR", f"{avg_ctr:.1f}%")

st.divider()

# ─── Top Hooks ────────────────────────────────────────────────
st.subheader("🔥 Top Performing Hooks")

if data:
    df = pd.DataFrame(data)
    if "score" not in df.columns:
        df["score"] = df.apply(compute_score, axis=1)
    df = df.sort_values("score", ascending=False)

    top10 = df.head(10)
    st.dataframe(
        top10[["hook", "structure", "cluster", "views", "clicks", "signups", "score"]],
        use_container_width=True,
        hide_index=True,
    )

    # Bar chart
    st.bar_chart(top10.set_index("hook")["score"], horizontal=True)
else:
    st.info("No performance data yet. Publish videos and track metrics.")

# ─── Cluster Performance ──────────────────────────────────────
if data:
    st.subheader("📊 Cluster Performance")
    cluster_df = df.groupby("cluster").agg(
        videos=("hook", "count"),
        avg_score=("score", "mean"),
        avg_views=("views", "mean"),
        avg_ctr=("clicks", lambda x: (x / df.loc[x.index, "views"]).mean() * 100),
    ).reset_index()

    st.dataframe(cluster_df, use_container_width=True, hide_index=True)

    best_cluster = cluster_df.loc[cluster_df["avg_score"].idxmax(), "cluster"]
    st.success(f"🏆 Best cluster: **{best_cluster}** (avg score: {cluster_df['avg_score'].max():.4f})")

# ─── Structure Distribution ───────────────────────────────────
st.subheader("🧩 Video Structure Distribution")
structures = {}
for v in data:
    s = v.get("structure", "unknown")
    structures[s] = structures.get(s, 0) + 1

if structures:
    struct_df = pd.DataFrame([{"Structure": k, "Count": v} for k, v in structures.items()])
    st.bar_chart(struct_df.set_index("Structure"))

# ─── Generated Videos ────────────────────────────────────────
if videos:
    st.subheader(f"📁 Generated Videos ({len(videos)})")
    st.dataframe(
        pd.DataFrame(videos),
        use_container_width=True,
        hide_index=True,
        column_config={
            "id": st.column_config.TextColumn("ID"),
            "name": st.column_config.TextColumn("Name"),
            "hook": st.column_config.TextColumn("Hook"),
            "structure": st.column_config.TextColumn("Structure"),
            "cluster": st.column_config.TextColumn("Cluster"),
            "file": st.column_config.TextColumn("File"),
        },
    )

# ─── Landing Mappings ────────────────────────────────────────
if landings:
    st.subheader(f"🌐 Landing Page Mappings ({len(landings)})")
    st.dataframe(
        pd.DataFrame(landings),
        use_container_width=True,
        hide_index=True,
        column_config={
            "video_name": "Video",
            "headline": "Landing Headline",
            "source_url": st.column_config.LinkColumn("URL"),
            "cluster": "Cluster",
        },
    )

# ─── Quick Actions ────────────────────────────────────────────
st.divider()
st.subheader("⚡ Quick Actions")

col_a, col_b, col_c = st.columns(3)

with col_a:
    if st.button("📊 Export Performance Data"):
        if data:
            st.json(data[:3])
        else:
            st.info("No data to export")

with col_b:
    if st.button("🎲 Generate 20 New Videos"):
        st.code("python vhs/scripts/content_engine.py --generate 20 --output vhs/output")

with col_c:
    if st.button("🔁 Run Evolution Loop"):
        st.code("python vhs/scripts/content_engine.py --evolve --data data/performance.json")
