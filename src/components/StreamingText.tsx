"use client";

import { useEffect, useState } from "react";

type StreamingTextProps = {
  text: string;
  className?: string;
  speed?: number;
};

export function StreamingText({ text, className, speed = 18 }: StreamingTextProps) {
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    setVisibleChars(0);
    const step = Math.max(1, Math.round(text.length / 90));
    const timer = window.setInterval(() => {
      setVisibleChars((current) => {
        if (current >= text.length) {
          window.clearInterval(timer);
          return current;
        }
        return Math.min(text.length, current + step);
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [text, speed]);

  const displayText = text.slice(0, visibleChars);
  const isComplete = visibleChars >= text.length;

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap leading-8 text-ink/90">{displayText || " "}</p>
      {!isComplete ? (
        <div className="mt-4 flex gap-2">
          <span className="h-2.5 w-16 animate-pulse rounded-full bg-accent/20" />
          <span className="h-2.5 w-10 animate-pulse rounded-full bg-coral/20" />
        </div>
      ) : null}
    </div>
  );
}
