import type { SVGProps } from 'react';

export const LogoIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg aria-hidden="true" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="mainGrad" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="100%" stopColor="#3a7bd5" />
        </linearGradient>
      </defs>
      <rect fill="#f8f9fa" height="500" rx="100" width="500" />

      <path
        d="M120 350 V150 L220 350 V150"
        fill="none"
        stroke="url(#mainGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="30"
      />

      <path
        d="M280 350 L330 150 L380 350"
        fill="none"
        stroke="url(#mainGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="30"
      />
      <line stroke="url(#mainGrad)" strokeLinecap="round" strokeWidth="30" x1="305" x2="355" y1="280" y2="280" />
    </svg>
  );
};
