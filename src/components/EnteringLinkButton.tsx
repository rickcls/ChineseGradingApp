"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

type EnteringLinkButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  enteringLabel?: string;
};

export function EnteringLinkButton({
  href,
  children,
  className,
  enteringLabel = "進入中…",
}: EnteringLinkButtonProps) {
  const pathname = usePathname();
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    setEntering(false);
  }, [pathname]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    setEntering(true);
  }

  return (
    <Link
      href={href}
      aria-busy={entering}
      onClick={handleClick}
      className={className}
    >
      {entering ? (
        <>
          <span aria-hidden="true" className="pending-spinner mr-2" />
          {enteringLabel}
        </>
      ) : (
        children
      )}
    </Link>
  );
}
