import React from 'react';

interface CognivoLogoProps {
  className?: string;
  size?: number;
}

/**
 * Cognivo Woven Geometric Hashtag Logo
 * Pixel-perfect SVG reproduction of the orange interlocking woven bars.
 */
export const CognivoLogo: React.FC<CognivoLogoProps> = ({ className = '', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* Top horizontal bar (shifted left) */}
      <rect x="6" y="14" width="28" height="6" rx="3" fill="#FF6B00" />
      {/* Bottom horizontal bar (shifted right) */}
      <rect x="14" y="28" width="28" height="6" rx="3" fill="#FF6B00" />
      {/* Left vertical bar (shifted down) */}
      <rect x="14" y="14" width="6" height="28" rx="3" fill="#FF6B00" />
      {/* Right vertical bar (shifted up) */}
      <rect x="28" y="6" width="6" height="28" rx="3" fill="#FF6B00" />
      {/* Center woven intersection accents to create 3D over-under effect */}
      <rect x="14" y="14" width="6" height="6" rx="1.5" fill="#FA5D00" />
      <rect x="28" y="28" width="6" height="6" rx="1.5" fill="#FA5D00" />
    </svg>
  );
};
