import Image from "next/image";

type MaverickIconProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function MaverickIcon({
  size = 24,
  className = "",
  priority = false,
}: MaverickIconProps) {
  return (
    <Image
      src="/maverick/maverick-shield.png"
      alt="The Maverick"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
