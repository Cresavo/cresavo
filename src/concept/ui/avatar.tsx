"use client";

import { useState } from "react";
import type { Staff } from "../data/types";
import { fullName } from "../selectors";
import { cx } from "./cx";

// Initials on a quiet neutral circle.

const sizes = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 } as const;

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

export function StaffAvatar({ person, size }: { person: Staff; size: keyof typeof sizes }) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const name = fullName(person);
  if (!person.photo || person.photo === failedPhoto) return <Avatar name={name} size={size} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Pre-sized, same-origin WebP from the demo pack.
    <img
      src={person.photo}
      alt={name}
      width={sizes[size]}
      height={sizes[size]}
      loading="lazy"
      className="aspect-square shrink-0 rounded-full object-cover"
      onError={() => setFailedPhoto(person.photo)}
    />
  );
}
