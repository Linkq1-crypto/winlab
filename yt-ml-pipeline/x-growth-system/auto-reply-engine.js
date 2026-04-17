// AI Auto-Reply Engine
// Usage: node auto-reply-engine.js "comment text"

const { classifyComment, generateAutoReply } = require('./x-growth-system/auto-reply-templates.json');

const comment = process.argv[2];
if (!comment) {
  console.log('Usage: node auto-reply-engine.js "comment text"');
  process.exit(1);
}

const result = generateAutoReply(comment, {
  topic: "Linux/Docker/AI",
  link: "https://winlab.cloud"
});

console.log('\n📝 Comment classified as:', result.category);
console.log('🤖 AI Reply:');
console.log('─'.repeat(50));
console.log(result.reply);
console.log('─'.repeat(50));
console.log('Confidence:', result.confidence);