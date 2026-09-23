import clsx from "clsx";
import { useState } from "react";

function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** Profile picture with a generated-initials fallback (no external requests needed). */
export function Avatar({ name, src, size = 32, ring = false, className }: { name: string; src?: string; size?: number; ring?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const h = hue(name);
  const initials = name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "?";
  const inner =
    src && !failed ? (
      <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full rounded-full object-cover" />
    ) : (
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
        style={{ background: `linear-gradient(135deg, hsl(${h} 55% 55%), hsl(${(h + 40) % 360} 55% 42%))`, fontSize: size * 0.38 }}
        aria-hidden
      >
        {initials}
      </span>
    );
  return (
    <span
      className={clsx("inline-flex shrink-0 rounded-full", ring ? "bg-brand-gradient p-[2px]" : "", className)}
      style={{ width: size, height: size }}
      title={`@${name}`}
    >
      {ring ? <span className="h-full w-full rounded-full bg-surface p-[1.5px]">{inner}</span> : inner}
    </span>
  );
}
