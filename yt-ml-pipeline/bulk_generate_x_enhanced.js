/**
 * Enhanced X (Twitter) Video Pipeline
 * Generates videos optimized for X engagement with:
 * - Thread-ready content (auto-converts to viral threads)
 * - Comment engagement hooks (boosts algorithm)
 * - Growth hack scenarios (attach to viral threads)
 * - Auto-reply AI setup
 */
const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const PEXELS_API_KEY = "CRz8idxdBEns26tgsUsZxLjCdceRbXrH0TnS9sh4XR36BOkY3Zo5znA5";
const OUTPUT_DIR = path.join(__dirname, "published", "x-videos-enhanced");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

// Enhanced topics with thread hooks & engagement triggers
const VIDEO_TOPICS = [
  // Thread-optimized content
  { 
    title: "AI_Thread_Auto_Reply", 
    query: "artificial intelligence robot chat", 
    hook: "AI That Auto-Replies to Comments",
    thread: "🧵 How I use AI to automatically reply to every comment on X\n\n1/ The algorithm LOVES engagement\n2/ I built an AI that reads & responds\n3/ Watch my engagement 10x\n\nHere's how 👇",
    color: "#00d4ff",
    engagement_type: "auto_reply"
  },
  { 
    title: "Viral_Thread_Generator", 
    query: "writing thread conversation", 
    hook: "Turn Any Post Into a Viral Thread",
    thread: "🧵 This AI tool turns your boring posts into VIRAL threads\n\n1/ Hook in first tweet\n2/ Value in middle tweets\n3/ CTA in last tweet\n\nWatch this 👇",
    color: "#1da1f2",
    engagement_type: "thread_generator"
  },
  { 
    title: "Growth_Hack_Attach", 
    query: "growth hacking trending viral", 
    hook: "Attach to Viral Threads (Growth Hack)",
    thread: "🧵 The growth hack nobody talks about:\n\n1/ Find viral threads in your niche\n2/ Add VALUE in replies\n3/ Watch followers flood in\n\nHere's my system 👇",
    color: "#ff6b6b",
    engagement_type: "growth_hack"
  },
  { 
    title: "Comment_Boost_Algorithm", 
    query: "social media engagement algorithm", 
    hook: "Boost Algorithm with Auto-Replies",
    thread: "🧵 X's algorithm PROMOTES posts with high engagement\n\n1/ Every reply = signal to algorithm\n2/ Auto-reply = more engagement\n3/ More reach = more followers\n\nMy setup 👇",
    color: "#10b981",
    engagement_type: "algorithm_boost"
  },
  { 
    title: "Scheduler_Auto_Post_X", 
    query: "schedule automation posting", 
    hook: "Complete Auto-Post Scheduler",
    thread: "🧵 I automated my entire X posting schedule\n\n1/ AI writes content\n2/ Scheduler posts it\n3/ Auto-reply engages\n\nZero manual work. Here's how 👇",
    color: "#f97316",
    engagement_type: "auto_post"
  },
  { 
    title: "X_Thread_Money", 
    query: "money revenue income stream", 
    hook: "Make Money with Threads",
    thread: "🧵 How I'm making $1000/month with X threads\n\n1/ Write valuable threads\n2/ Get followers\n3/ Monetize with products\n\nMy exact strategy 👇",
    color: "#059669",
    engagement_type: "monetization"
  },
  // Quick tech tips (X-friendly format)
  { 
    title: "Linux_60_Seconds", 
    query: "linux terminal code fast", 
    hook: "Linux in 60 Seconds",
    thread: "🧵 Learn Linux in 60 seconds\n\n1/ pwd - where am I?\n2/ ls - what's here?\n3/ cd - take me there\n4/ mkdir - create folder\n5/ rm - delete stuff\n\nMore tips 👇",
    color: "#00d4ff",
    engagement_type: "quick_tip"
  },
  { 
    title: "Git_Cheat_Sheet", 
    query: "git version control code", 
    hook: "Git Commands You NEED to Know",
    thread: "🧵 Git commands that will save you HOURS\n\n1/ git stash - save work temporarily\n2/ git rebase - clean history\n3/ git cherry-pick - pick commits\n4/ git reset --hard - undo everything\n\nSave this 👇",
    color: "#f05032",
    engagement_type: "cheat_sheet"
  },
  { 
    title: "Docker_Explain_Like_5", 
    query: "docker container technology simple", 
    hook: "Docker Explained Simply",
    thread: "🧵 Docker explained like you're 5\n\n1/ Container = box with everything inside\n2/ Image = template for the box\n3/ Dockerfile = recipe to build the box\n\nSimple, right? 👇",
    color: "#2496ed",
    engagement_type: "explain_simply"
  },
  { 
    title: "Nginx_Quick_Fix", 
    query: "nginx server configuration fix", 
    hook: "Fix Nginx Errors Fast",
    thread: "🧵 Nginx errors driving you crazy?\n\n1/ 502 Bad Gateway = backend down\n2/ 404 Not Found = wrong path\n3/ 403 Forbidden = permissions\n4/ 504 Timeout = backend slow\n\nFix them all 👇",
    color: "#009639",
    engagement_type: "error_fix"
  },
  // AI + Tech combo content
  { 
    title: "AI_Code_Review", 
    query: "ai code review analysis", 
    hook: "AI Reviews Your Code",
    thread: "🧵 I let AI review my code before every PR\n\n1/ Catches bugs I missed\n2/ Suggests better patterns\n3/ Explains WHY it's better\n\nMy setup 👇",
    color: "#8b5cf6",
    engagement_type: "ai_tool"
  },
  { 
    title: "Prompt_Engineering_Tips", 
    query: "prompt engineering ai chatgpt", 
    hook: "Prompt Engineering 101",
    thread: "🧵 Prompt engineering tips that actually work\n\n1/ Be SPECIFIC\n2/ Give EXAMPLES\n3/ Set CONSTRAINTS\n4/ Ask for FORMAT\n\nWatch results improve 👇",
    color: "#10b981",
    engagement_type: "ai_tips"
  },
  { 
    title: "Free_AI_Tools", 
    query: "free ai tools technology", 
    hook: "10 Free AI Tools for Devs",
    thread: "🧵 10 FREE AI tools I use daily as a developer\n\n1/ ChatGPT - code help\n2/ GitHub Copilot - autocomplete\n3/ Claude - long context\n4/ Midjourney - images\n5/ ElevenLabs - voice\n\nFull list 👇",
    color: "#ef4444",
    engagement_type: "tool_list"
  },
  // Career & productivity
  { 
    title: "Dev_Productivity_Hacks", 
    query: "developer productivity productivity hack", 
    hook: "Dev Productivity Hacks",
    thread: "🧵 Developer productivity hacks that changed my life\n\n1/ Time block deep work\n2/ Automate repetitive tasks\n3/ Use AI for code reviews\n4/ Build templates for everything\n\nMore tips 👇",
    color: "#f59e0b",
    engagement_type: "productivity"
  },
  { 
    title: "Remote_Work_Setup", 
    query: "remote work home office developer", 
    hook: "Perfect Remote Setup",
    thread: "🧵 My remote dev setup after 3 years WFH\n\n1/ Standing desk (game changer)\n2/ Dual monitors\n3/ Noise cancelling headphones\n4/ Scheduled deep work blocks\n\nFull tour 👇",
    color: "#06b6d4",
    engagement_type: "setup_tour"
  },
  { 
    title: "Learn_Code_Faster", 
    query: "learning programming study fast", 
    hook: "Learn to Code 10x Faster",
    thread: "🧵 How I learned to code 10x faster\n\n1/ Build projects (not tutorials)\n2/ Read other people's code\n3/ Contribute to open source\n4/ Teach what you learn\n\nMy journey 👇",
    color: "#ec4899",
    engagement_type: "learning_tips"
  },
  // X growth strategies
  { 
    title: "X_Algorithm_Hack_2024", 
    query: "algorithm social media growth 2024", 
    hook: "Hack the X Algorithm",
    thread: "🧵 How to hack the X algorithm in 2024\n\n1/ Post at peak hours\n2/ Reply to EVERY comment\n3/ Use threads (not single posts)\n4/ Engage before posting\n\nMy results 👇",
    color: "#1da1f2",
    engagement_type: "algorithm_hack"
  },
  { 
    title: "First_1000_Followers", 
    query: "followers growth social media strategy", 
    hook: "Get 1000 Followers Fast",
    thread: "🧵 How I got my first 1000 followers on X\n\n1/ Post valuable content daily\n2/ Reply to big accounts\n3/ Use threads for deep topics\n4/ Engage authentically\n\nMy full story 👇",
    color: "#ff6b6b",
    engagement_type: "growth_story"
  },
  { 
    title: "Content_Repurpose_AI", 
    query: "content repurpose ai automation", 
    hook: "Repurpose Content with AI",
    thread: "🧵 I repurpose 1 video into 30 posts with AI\n\n1/ Transcribe video\n2/ Extract key points\n3/ Generate tweets\n4/ Schedule automatically\n\nMy workflow 👇",
    color: "#a855f7",
    engagement_type: "content_repurpose"
  },
  { 
    title: "Engagement_Pod_Alternative", 
    query: "engagement organic growth authentic", 
    hook: "No Engagement Pods Needed",
    thread: "🧵 Why engagement pods are DEAD (and what to do instead)\n\n1/ Algorithm detects fake engagement\n2/ Real replies = real reach\n3/ Build genuine relationships\n\nMy strategy 👇",
    color: "#10b981",
    engagement_type: "organic_growth"
  }
];

function addOverlayEnhanced(inputPath, outputPath, hook, color, threadPreview = null) {
  const overlays = [
    `drawbox=x=0:y=0:w=iw:h=100:color=black@0.8:t=fill`,
    `drawtext=text='${hook}':fontsize=52:fontcolor=${color}:x=30:y=20:fontfile='C\\:\\\\Windows\\\\Fonts\\\\arial.ttf'`,
    `drawbox=x=0:y=h-60:w=iw:h=60:color=black@0.7:t=fill`,
    `drawtext=text='WinLab.cloud | Follow for more':fontsize=28:fontcolor=#ffffff:x=(w-text_w)/2:y=h-50:fontfile='C\\:\\\\Windows\\\\Fonts\\\\arial.ttf'`
  ];

  if (threadPreview) {
    overlays.push(
      `drawbox=x=20:y=h-140:w=iw-40:h=70:color=#1da1f2@0.3:t=fill`,
      `drawtext=text='🧵 Thread preview included':fontsize=24:fontcolor=#1da1f2:x=30:y=h-130:fontfile='C\\:\\\\Windows\\\\Fonts\\\\arial.ttf'`
    );
  }

  const vf = overlays.join(",");

  const args = [
    "-i", inputPath,
    "-vf", vf,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-c:a", "copy",
    "-t", "30",
    "-movflags", "+faststart",
    "-y",
    outputPath
  ];

  const result = spawnSync(FFMPEG, args, { stdio: "pipe", timeout: 120000 });
  return result.status === 0;
}

function generateThreadFile(topic) {
  const threadPath = path.join(OUTPUT_DIR, `${topic.title}_thread.txt`);
  const content = `
${"=".repeat(60)}
THREAD: ${topic.title}
${"=".repeat(60)}

TOPIC: ${topic.hook}
ENGAGEMENT TYPE: ${topic.engagement_type}
COLOR: ${topic.color}

${"─".repeat(60)}
FULL THREAD (ready to post):
${"─".repeat(60)}

${topic.thread}

${"─".repeat(60)}
HOOK LINE (for video):
${"─".repeat(60)}

${topic.hook}

${"─".repeat(60)}
CALL TO ACTION:
${"─".repeat(60)}

Follow @WinLabCloud for more tech tips
Visit: winlab.cloud

${"=".repeat(60)}
`;
  fs.writeFileSync(threadPath, content.trim());
  return threadPath;
}

function generateMetadataJSON(topics) {
  const metadata = {
    generated_at: new Date().toISOString(),
    total_videos: topics.length,
    optimization: "X (Twitter) - Thread + Auto-Reply + Growth Hack",
    videos: topics.map(t => ({
      title: t.title,
      hook: t.hook,
      engagement_type: t.engagement_type,
      video_file: `${t.title}.mp4`,
      thread_file: `${t.title}_thread.txt`,
      color: t.color
    }))
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );
}

async function searchPexels(query) {
  try {
    const res = await axios.get("https://api.pexels.com/videos/search", {
      params: { query, per_page: 5, orientation: "landscape" },
      headers: { Authorization: PEXELS_API_KEY }
    });
    return res.data.videos;
  } catch (err) {
    console.error(`❌ Pexels API error: ${err.message}`);
    return [];
  }
}

async function downloadVideo(videoUrl, outputPath) {
  const res = await axios({
    url: videoUrl,
    method: "GET",
    responseType: "stream",
    timeout: 60000
  });
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function run() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`🎬 Enhanced X Video Pipeline\n`);
  console.log(`Features:`);
  console.log(`  ✓ Thread-ready content`);
  console.log(`  ✓ Auto-reply engagement hooks`);
  console.log(`  ✓ Growth hack scenarios`);
  console.log(`  ✓ Algorithm boost optimization\n`);
  console.log(`Generating ${VIDEO_TOPICS.length} videos...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < VIDEO_TOPICS.length; i++) {
    const topic = VIDEO_TOPICS[i];
    console.log(`\n[${i + 1}/${VIDEO_TOPICS.length}] ${topic.title}`);
    console.log(`   Hook: ${topic.hook}`);
    console.log(`   Type: ${topic.engagement_type}`);

    try {
      // Generate thread file
      generateThreadFile(topic);
      console.log(`  📝 Thread file created`);

      // Search Pexels
      const videos = await searchPexels(topic.query);
      if (!videos.length) {
        console.log(`  ⚠️ No footage found, skipping`);
        failed++;
        continue;
      }

      // Download best quality
      const best = videos[0];
      const videoFile = best.video_files.find(f => f.quality === "hd") || 
                        best.video_files.find(f => f.quality === "sd") || 
                        best.video_files[0];
      const rawPath = path.join(OUTPUT_DIR, `_raw_${Date.now()}.mp4`);
      const finalPath = path.join(OUTPUT_DIR, `${topic.title}.mp4`);

      await downloadVideo(videoFile.link, rawPath);
      const size = (fs.statSync(rawPath).size / 1024 / 1024).toFixed(1);
      console.log(`  ✅ Downloaded: ${size} MB`);

      // Add enhanced overlay
      const ok = addOverlayEnhanced(rawPath, finalPath, topic.hook, topic.color, topic.thread);
      await fs.remove(rawPath);

      if (ok && fs.existsSync(finalPath)) {
        const finalSize = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
        console.log(`  ✅ READY: ${finalSize} MB`);
        success++;
      } else {
        console.log(`  ⚠️ Overlay failed`);
        failed++;
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }

  // Generate metadata
  generateMetadataJSON(VIDEO_TOPICS);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`🎉 DONE! ${success} successful, ${failed} failed`);
  console.log(`📁 Videos: ${OUTPUT_DIR}`);
  console.log(`📝 Threads: ${OUTPUT_DIR} (one per video)`);
  console.log(`📊 Metadata: ${path.join(OUTPUT_DIR, "metadata.json")}`);
  console.log(`${"═".repeat(60)}`);
}

run().catch(console.error);
