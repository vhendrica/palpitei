const P_PATH =
  "M24 16 H55 C68 16 78 26 78 38 C78 50 68 60 55 60 H41 V84 H24 Z M41 30 V46 H54 C58.5 46 62 42.5 62 38 C62 33.5 58.5 30 54 30 Z";
const CHECK_PATH = "M48 66 L60 78 L86 50";

/** Marca Palpitei: "P" com um sinal de certo verde. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Palpitei">
      <rect width="100" height="100" rx="24" fill="#1E1E1E" />
      <g transform="translate(6 4) scale(0.88)">
        <path d={P_PATH} fill="#FFFFFF" fillRule="evenodd" />
        <path
          d={CHECK_PATH}
          fill="none"
          stroke="#1E1E1E"
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={CHECK_PATH}
          fill="none"
          stroke="#00FF88"
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
