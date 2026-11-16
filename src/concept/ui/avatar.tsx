import { cx } from "./cx";

// Generated avatars: initials on a soft pastel. No photos of people.

const PALETTE = [
  ["#E6EFE9", "#2F5D50"],
  ["#F4E6DA", "#8A4B2C"],
  ["#E8E6F3", "#4B4680"],
  ["#F3E4E8", "#86405A"],
  ["#E3EDF3", "#2E5A75"],
  ["#F2EDD9", "#6E5A1E"],
  ["#E9F0E1", "#4A6326"],
  ["#EFE5F0", "#6E3F78"],
];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const sizes = { sm: 32, md: 40, lg: 56, xl: 80 } as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const px = sizes[size];
  const [bg, fg] = PALETTE[hash(name) % PALETTE.length];
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
      <circle cx="20" cy="20" r="20" fill={bg} />
      <text x="20" y="20" dy="0.35em" textAnchor="middle" fontSize="14" fontWeight="600" fill={fg} fontFamily="inherit">
        {initials}
      </text>
    </svg>
  );
}
