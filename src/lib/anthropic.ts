import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL || "google/gemini-2.5-flash";
export const COACH_MODEL = process.env.COACH_MODEL || "anthropic/claude-3.5-haiku";
export const OCR_MODEL = process.env.OCR_MODEL || process.env.ANALYSIS_MODEL || "google/gemini-2.5-flash";

type GenerateTextInput = {
  system: string;
  user: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
};

type GenerateVisionTextInput = GenerateTextInput & {
  imageDataUrl: string;
};

function contentFromOpenRouter(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          "text" in part &&
          (part as { type: unknown }).type === "text"
        ) {
          return String((part as { text: unknown }).text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

async function generateWithOpenRouter(input: GenerateTextInput): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_HTTP_REFERER
        ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
        : {}),
      ...(process.env.OPENROUTER_APP_NAME ? { "X-Title": process.env.OPENROUTER_APP_NAME } : {}),
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 4096,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${details}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = contentFromOpenRouter(json.choices?.[0]?.message?.content);
  if (!content) throw new Error("OpenRouter returned empty content");
  return content;
}

async function generateWithAnthropic(input: GenerateTextInput): Promise<string> {
  const anthropic = getAnthropic();
  const msg = await anthropic.messages.create({
    model: input.model,
    max_tokens: input.maxTokens ?? 4096,
    temperature: input.temperature ?? 0.2,
    system: input.system,
    messages: [{ role: "user", content: input.user }],
  });

  const textBlock = msg.content.find(
    (b: { type: string; text?: string }) => b.type === "text",
  );
  if (!textBlock || textBlock.type !== "text" || typeof textBlock.text !== "string") {
    throw new Error("Model returned no text content");
  }
  return textBlock.text;
}

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image payload");
  }

  const mediaType = normalizeAnthropicImageType(match[1]);

  return {
    mediaType,
    data: match[2],
  };
}

function normalizeAnthropicImageType(mediaType: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mediaType === "image/jpeg" || mediaType === "image/png" || mediaType === "image/gif" || mediaType === "image/webp") {
    return mediaType;
  }

  if (mediaType === "image/jpg") return "image/jpeg";
  throw new Error(`Unsupported image type: ${mediaType}`);
}

async function generateVisionWithOpenRouter(input: GenerateVisionTextInput): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_HTTP_REFERER
        ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
        : {}),
      ...(process.env.OPENROUTER_APP_NAME ? { "X-Title": process.env.OPENROUTER_APP_NAME } : {}),
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.1,
      max_tokens: input.maxTokens ?? 4096,
      messages: [
        { role: "system", content: input.system },
        {
          role: "user",
          content: [
            { type: "text", text: input.user },
            { type: "image_url", image_url: { url: input.imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${details}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = contentFromOpenRouter(json.choices?.[0]?.message?.content);
  if (!content) throw new Error("OpenRouter returned empty content");
  return content;
}

async function generateVisionWithAnthropic(input: GenerateVisionTextInput): Promise<string> {
  const anthropic = getAnthropic();
  const image = parseImageDataUrl(input.imageDataUrl);
  const msg = await anthropic.messages.create({
    model: input.model,
    max_tokens: input.maxTokens ?? 4096,
    temperature: input.temperature ?? 0.1,
    system: input.system,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: input.user },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.data,
            },
          },
        ],
      },
    ],
  });

  const textBlock = msg.content.find(
    (b: { type: string; text?: string }) => b.type === "text",
  );
  if (!textBlock || textBlock.type !== "text" || typeof textBlock.text !== "string") {
    throw new Error("Model returned no text content");
  }
  return textBlock.text;
}

export async function generateModelText(input: GenerateTextInput): Promise<string> {
  if (process.env.OPENROUTER_API_KEY) {
    return generateWithOpenRouter(input);
  }
  return generateWithAnthropic(input);
}

export async function generateVisionModelText(input: GenerateVisionTextInput): Promise<string> {
  if (process.env.OPENROUTER_API_KEY) {
    return generateVisionWithOpenRouter(input);
  }
  return generateVisionWithAnthropic(input);
}
