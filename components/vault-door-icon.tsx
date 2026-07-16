import type { SVGProps } from "react";

export default function VaultDoorIcon({
  className = "",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="3"
      />

      <circle
        cx="32"
        cy="32"
        r="20"
        stroke="currentColor"
        strokeWidth="2.5"
      />

      <circle
        cx="32"
        cy="32"
        r="7"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2.5"
      />

      <path
        d="M32 12V25M32 39V52M12 32H25M39 32H52M18 18L27 27M37 37L46 46M46 18L37 27M27 37L18 46"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      <circle cx="32" cy="7" r="2.5" fill="currentColor" />
      <circle cx="32" cy="57" r="2.5" fill="currentColor" />
      <circle cx="7" cy="32" r="2.5" fill="currentColor" />
      <circle cx="57" cy="32" r="2.5" fill="currentColor" />

      <path
        d="M8 23H3V41H8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
