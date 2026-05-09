const AVATAR_PALETTE = [
  '#E53E3E', '#DD6B20', '#D69E2E', '#38A169',
  '#319795', '#3182CE', '#553C9A', '#B83280',
  '#2C7A7B', '#276749', '#744210', '#2D3748',
];

export function nameToAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟؟';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
