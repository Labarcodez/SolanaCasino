export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function avatarGradient(seed: string): string {
  const hue = avatarHue(seed);
  return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 70%, 45%))`;
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function authProviderLabel(
  provider: string,
): string {
  switch (provider) {
    case "google":
      return "Google";
    case "apple":
      return "Apple";
    case "phantom":
      return "Phantom";
    case "wallet":
    case "injected":
      return "Phantom Wallet";
    default:
      return "Wallet";
  }
}
