import { cx } from "./cx";

// Generated avatars: initials on a quiet neutral circle, the same for everyone.
// No photos of people, and no colour that could be read as a status.

const sizes = { sm: 32, md: 40, lg: 56, xl: 80 } as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const px = sizes[size];
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 40 40"
      role="img"
      aria-label={name}
      className={cx("shrink-0 rounded-full", className)}
    >
      <circle cx="20" cy="20" r="20" className="fill-surface-2" />
      <text x="20" y="20" dy="0.35em" textAnchor="middle" fontSize="14" fontWeight="600" className="fill-text-secondary" fontFamily="inherit">
        {initials}
      </text>
    </svg>
  );
}
