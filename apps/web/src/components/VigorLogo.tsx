interface Props {
  height?: number;
  className?: string;
}

export default function VigorLogo({ height = 32, className }: Props) {
  const width = Math.round(height * (3.5));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 130 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Vigor"
      role="img"
      className={className}
    >
      <text
        y="32"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
        fontSize="36"
        fontWeight="700"
        letterSpacing="-1"
      >
        <tspan fill="#6C63FF">V</tspan><tspan fill="white">igor</tspan>
      </text>
    </svg>
  );
}

export function VigorMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="V"
      role="img"
    >
      <text
        x="1"
        y="32"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
        fontSize="36"
        fontWeight="700"
        fill="#6C63FF"
      >V</text>
    </svg>
  );
}
