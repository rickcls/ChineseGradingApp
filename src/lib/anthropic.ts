import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

const FAST_FALLBACK_MODEL = process.env.FAST_FALLBACK_MODEL || "google/gemini-2.5-flash";
const DEFAULT_ANALYSIS_TIMEOUT_MS = parsePositiveInt(process.env.ANALYSIS_OPENROUTER_TIMEOUT_MS, 90000);
const DEFAULT_OCR_TIMEOUT_MS = parsePositiveInt(process.env.OCR_OPENROUTER_TIMEOUT_MS, 45000);

function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client = new Anthropic({ apiKey });
  return client;
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL || FAST_FALLBACK_MODEL;
export const ANALYSIS_FALLBACK_MODEL = process.env.ANALYSIS_FALLBACK_MODEL || FAST_FALLBACK_MODEL;
export const COACH_MODEL = process.env.COACH_MODEL || "anthropic/claude-3.5-haiku";
export const OCR_MODEL = process.env.OCR_MODEL || process.env.ANALYSIS_MODEL || FAST_FALLBACK_MODEL;
export const OCR_FALLBACK_MODEL =
  process.env.OCR_FALLBACK_MODEL || process.env.ANALYSIS_FALLBACK_MODEL || FAST_FALLBACK_MODEL;

type GenerateTextInput = {
  system: string;
  user: string;
  model: string;
  fallbackModel?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  taskName?: string;
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

function isRetryableModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(timed out|request failed \((408|409|425|429|500|502|503|504|524)\)|returned empty content)/i.test(message);
}

function logModelEvent(taskName: string, model: string, startedAt: number, outcome: "ok" | "retry" | "fail") {
  const durationMs = Date.now() - startedAt;
  const prefix = `[model:${taskName}]`;
  const message = `${prefix} ${model} ${outcome} in ${durationMs}ms`;

  if (outcome === "fail") {
    console.error(message);
    return;
  }

  if (outcome === "retry") {
    console.warn(message);
    return;
  }

  console.info(message);
}

async function withModelFallback<T>(
  input: GenerateTextInput,
  run: (model: string) => Promise<T>,
): Promise<T> {
  const primaryModel = input.model;
  const fallbackModel = input.fallbackModel?.trim();

  const startedAt = Date.now();
  try {
    const result = await run(primaryModel);
    logModelEvent(input.taskName || "text", primaryModel, startedAt, "ok");
    return result;
  } catch (primaryError) {
    logModelEvent(input.taskName || "text", primaryModel, startedAt, fallbackModel ? "retry" : "fail");

    if (!fallbackModel || fallbackModel === primaryModel || !isRetryableModelError(primaryError)) {
      throw primaryError;
    }

    const fallbackStartedAt = Date.now();
    try {
      const result = await run(fallbackModel);
      logModelEvent(input.taskName || "text", fallbackModel, fallbackStartedAt, "ok");
      return result;
    } catch (fallbackError) {
      logModelEvent(input.taskName || "text", fallbackModel, fallbackStartedAt, "fail");
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Primary model "${primaryModel}" failed: ${primaryMessage}. Fallback model "${fallbackModel}" also failed: ${fallbackMessage}`,
      );
    }
  }
}

async function openRouterFetch(
  payload: unknown,
  context: { model: string; timeoutMs: number; taskName: string },
): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), context.timeoutMs);

  try {
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
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${details}`);
    }

    return response;
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error(`OpenRouter ${context.taskName} timed out after ${context.timeoutMs}ms using ${context.model}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateWithOpenRouter(input: GenerateTextInput): Promise<string> {
  return withModelFallback(input, async (model) => {
    const response = await openRouterFetch(
      {
        model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 4096,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      },
      {
        model,
        timeoutMs: input.timeoutMs ?? DEFAULT_ANALYSIS_TIMEOUT_MS,
        taskName: input.taskName || "text",
      },
    );

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = contentFromOpenRouter(json.choices?.[0]?.message?.content);
    if (!content) throw new Error("OpenRouter returned empty content");
    return content;
  });
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
  return withModelFallback(input, async (model) => {
    const response = await openRouterFetch(
      {
        model,
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
      },
      {
        model,
        timeoutMs: input.timeoutMs ?? DEFAULT_OCR_TIMEOUT_MS,
        taskName: input.taskName || "vision",
      },
    );

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = contentFromOpenRouter(json.choices?.[0]?.message?.content);
    if (!content) throw new Error("OpenRouter returned empty content");
    return content;
  });
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
