const P_PATH =
  "M275 527 H565 C678 527 768 619 768 732 C768 845 678 937 565 937 H447 V817 H565 C608 817 643 779 643 732 C643 685 608 647 565 647 H402 V1111 H275 Z";
const CHECK_PATH = "M807 851 L896 771 L987 899 L1460 465 L987 1103 Z";

/** Marca PALPIT: "P" com o sinal de certo, verde #00C447 sobre preto. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1600 1600" aria-label="PALPIT">
      <rect width="1600" height="1600" rx="360" fill="#000000" />
      <path d={P_PATH} fill="#00C447" />
      <path d={CHECK_PATH} fill="#00C447" />
    </svg>
  );
}
