"use client";

import { useEffect, useState } from "react";

type StreamingTextProps = {
  text: string;
  className?: string;
  speed?: number;
};

export function StreamingText({ text, className, speed = 18 }: StreamingTextProps) {
  const tokens = splitIntoStreamingTokens(text);
  const [visibleTokens, setVisibleTokens] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleTokens(tokens.length);
      return;
    }

    setVisibleTokens(0);
    const step = Math.max(1, Math.round(tokens.length / 110));
    const timer = window.setInterval(() => {
      setVisibleTokens((current) => {
        if (current >= tokens.length) {
          window.clearInterval(timer);
          return current;
        }
        return Math.min(tokens.length, current + step);
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [text, speed, tokens.length]);

  const visibleTextTokens = tokens.slice(0, visibleTokens);
  const isComplete = visibleTokens >= tokens.length;

  return (
    <div className={className}>
      <p className="streaming-text-line whitespace-pre-wrap leading-8 text-ink/90" aria-live="polite">
        {visibleTextTokens.length > 0
          ? visibleTextTokens.map((token, index) => (
              <span
                key={`${index}-${token}`}
                className={token.trim() ? "streaming-token" : undefined}
              >
                {token}
              </span>
            ))
          : " "}
        {!isComplete ? <span className="streaming-cursor" aria-hidden="true" /> : null}
      </p>
      {!isComplete ? (
        <div className="mt-4 flex gap-2">
          <span className="h-2.5 w-16 animate-pulse rounded-full bg-accent/20" />
          <span className="h-2.5 w-10 animate-pulse rounded-full bg-coral/20" />
        </div>
      ) : null}
    </div>
  );
}

function splitIntoStreamingTokens(text: string) {
  const tokens: string[] = [];
  let currentWord = "";

  for (const char of Array.from(text)) {
    if (/\s/.test(char)) {
      flushWord();
      tokens.push(char);
      continue;
    }

    if (isCjkCharacter(char) || isSentencePunctuation(char)) {
      flushWord();
      tokens.push(char);
      continue;
    }

    currentWord += char;
  }

  flushWord();
  return tokens;

  function flushWord() {
    if (!currentWord) return;
    tokens.push(currentWord);
    currentWord = "";
  }
}

function isCjkCharacter(char: string) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(char);
}

function isSentencePunctuation(char: string) {
  return /[，。！？、；：,.!?;:()[\]「」『』《》]/.test(char);
}
