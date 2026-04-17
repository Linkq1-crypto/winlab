/**
 * ElevenLabs Text-to-Speech Handler
 * Supports EN and HI-EN (Hinglish) voices
 * Async generation with webhook callback
 */

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  model: string;
}

interface TTSOptions {
  text: string;
  language?: "en" | "hi-en";
  stability?: number;
  similarity?: number;
  style?: number;
}

const DEFAULT_VOICES = {
  en: "EXAVITQu4vr4xnSDxMaL", // Rachel - clear, professional
  hiEn: "VR6AewLTigWG4xSOukaG" // Arnold - neutral, good for Hinglish
};

/**
 * Generate speech from text using ElevenLabs API
 * @returns Audio file as ArrayBuffer
 */
export async function generateSpeech(
  options: TTSOptions,
  config: ElevenLabsConfig
): Promise<ArrayBuffer> {
  const voiceId = config.voiceId || 
    (options.language === "hi-en" ? DEFAULT_VOICES.hiEn : DEFAULT_VOICES.en);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey
      },
      body: JSON.stringify({
        text: options.text,
        model_id: config.model || "eleven_monolingual_v1",
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarity ?? 0.75,
          style: options.style ?? 0.0,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API failed: ${error}`);
  }

  return await response.arrayBuffer();
}

/**
 * Generate speech and upload to R2
 * @returns R2 key
 */
export async function generateAndUpload(
  options: TTSOptions,
  config: ElevenLabsConfig,
  bucket: R2Bucket,
  key: string
): Promise<string> {
  const audioBuffer = await generateSpeech(options, config);

  await bucket.put(key, audioBuffer, {
    httpMetadata: { contentType: "audio/mpeg" }
  });

  console.log(`🎙️ TTS uploaded to R2: ${key}`);
  return key;
}

/**
 * Create TTS job for async processing
 */
export interface TTSJob {
  id: string;
  text: string;
  language: "en" | "hi-en";
  outputKey: string;
  webhookUrl?: string;
}

/**
 * Process TTS job (for queue processing)
 */
export async function processTTSJob(
  job: TTSJob,
  config: ElevenLabsConfig,
  bucket: R2Bucket
): Promise<string> {
  console.log(`🎙️ Processing TTS job ${job.id}...`);

  return await generateAndUpload(
    {
      text: job.text,
      language: job.language
    },
    config,
    bucket,
    job.outputKey
  );
}

/**
 * Get available voices
 */
export async function getVoices(config: ElevenLabsConfig) {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/voices",
    {
      headers: { "xi-api-key": config.apiKey }
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch voices");
  }

  const data = await response.json();
  return data.voices;
}

/**
 * Estimate character count and cost
 */
export function estimateCost(text: string, pricePerChar: number = 0.0003): { chars: number; cost: number } {
  const chars = text.length;
  const cost = chars * pricePerChar;
  return { chars, cost };
}
