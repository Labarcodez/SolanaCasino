import { avatarGradient, avatarInitials } from "../lib/avatar";

interface ProfileAvatarProps {
  seed: string;
  name: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: 28,
  md: 36,
  lg: 56,
};

export function ProfileAvatar({ seed, name, size = "md" }: ProfileAvatarProps) {
  const px = SIZES[size];
  const fontSize = size === "sm" ? "0.7rem" : size === "lg" ? "1rem" : "0.8rem";

  return (
    <span
      className="profile-avatar"
      style={{
        width: px,
        height: px,
        background: avatarGradient(seed),
        fontSize,
      }}
      aria-hidden="true"
    >
      {avatarInitials(name)}
    </span>
  );
}
