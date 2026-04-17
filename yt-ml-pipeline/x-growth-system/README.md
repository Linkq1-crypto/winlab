# X Growth System

Complete system for growing on X (Twitter) using AI automation.

## What's Inside

### 1. Auto-Reply System (auto-replies/)
AI that automatically replies to comments on your posts.
- **Why**: Engagement = algorithm boost = more reach
- **How**: Classifies comment type, generates contextual reply
- **Usage**: Run node auto-reply-engine.js "comment text"

### 2. Thread Search Queries (thread-search-queries.json)
Pre-built search queries to find viral threads in your niche.
- **Why**: Attach to viral threads = instant followers
- **How**: Search X for these queries, sort by "Latest", reply fast
- **Categories**: Tech, AI, Career/Productivity

### 3. Growth Playbook (growth-playbook.json)
4 proven strategies for X growth:
1. **Viral Thread Attachment** - 50-200 followers per thread
2. **Auto-Reply Boost** - 3-5x more impressions
3. **Content Repurposing** - 1 video = 1 week of threads
4. **Organic Engagement** - 20-50 followers/day

### 4. Thread Generator
Each video from bulk_generate_x_enhanced.js has a companion .txt file with:
- Full thread (ready to post)
- Hook tweet (first tweet with video)
- Follow-up tweets
- CTA (call to action)
- Engagement strategy

## Quick Start

### Step 1: Generate Videos
```bash
node bulk_generate_x_enhanced.js
```

### Step 2: Post Threads
For each video:
1. Open ${title}_thread.txt
2. Post first tweet with video attached
3. Post follow-up tweets as replies
4. Enable auto-replies

### Step 3: Enable Auto-Replies
```bash
node auto-reply-engine.js "Great tips! Thanks for sharing"
```

### Step 4: Find Viral Threads
Search X for queries in thread-search-queries.json
- Sort by "Latest"
- Reply within first 10 responses
- Provide MORE value than original thread

### Step 5: Track Results
Monitor:
- Followers gained per thread
- Impressions per post
- Auto-reply engagement rate
- Thread attachment success rate

## Expected Results

With consistent execution:
- **Week 1**: 100-300 followers
- **Week 2**: 300-700 followers
- **Week 3**: 700-1500 followers
- **Week 4**: 1500-3000+ followers

## Important

- Auto-replies must look NATURAL (30-120s delay)
- Provide REAL value in replies (not generic)
- Don't spam - be genuine
- Track what works, double down on winners

## Customization

Edit these files to customize:
- auto-replies/templates.json - Reply templates
- thread-search-queries.json - Search queries
- growth-playbook.json - Strategies

---

Built for WinLab.cloud | Follow @WinLabCloud