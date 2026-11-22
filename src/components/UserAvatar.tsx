import { useState } from 'react';

interface Props {
  src?: string | null;
  name: string;
  sizeClass?: string;
  ringClass?: string;
}

export function UserAvatar({
  src,
  name,
  sizeClass = 'h-10 w-10',
  ringClass = 'ring-1 ring-white/15',
}: Props) {
  const [failed, setFailed] = useState(false);
  const initials = (name || 'U').trim().slice(0, 2).toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} ${ringClass} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED]/80 via-[#312E81] to-[#00D4FF]/60 font-display text-xs font-bold text-white select-none`}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} ${ringClass} shrink-0 rounded-full object-cover bg-[#141422]`}
    />
  );
}
