/** Mockup de iPhone: borda preta 12px, raio 48px, sombra grande. */
export function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 360,
        height: 740,
        borderRadius: 48,
        border: "12px solid #000",
        boxShadow: "0 0 0 2px #2b2b2b, 0 30px 80px rgba(0,0,0,0.8)",
        background: "#121212",
      }}
    >
      <span className="absolute -left-[15px] top-[110px] h-8 w-[3px] rounded-l bg-[#2b2b2b]" />
      <span className="absolute -left-[15px] top-[160px] h-14 w-[3px] rounded-l bg-[#2b2b2b]" />
      <span className="absolute -left-[15px] top-[228px] h-14 w-[3px] rounded-l bg-[#2b2b2b]" />
      <span className="absolute -right-[15px] top-[180px] h-20 w-[3px] rounded-r bg-[#2b2b2b]" />
      <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-bg">
        <div className="relative z-30 flex h-11 items-center justify-between px-7 pt-1 text-[13px] font-semibold">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff" aria-hidden>
              <rect x="0" y="7" width="3" height="4" rx="1" />
              <rect x="4.5" y="5" width="3" height="6" rx="1" />
              <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
              <rect x="13.5" y="0" width="3" height="11" rx="1" />
            </svg>
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M1.2 4a9 9 0 0 1 12.6 0M3.6 6.5a5.5 5.5 0 0 1 7.8 0" />
              <circle cx="7.5" cy="9.2" r="1" fill="#fff" stroke="none" />
            </svg>
            <span className="relative inline-block h-[11px] w-[23px] rounded-[3.5px] border border-white/50 p-[1.5px]">
              <span className="block h-full w-[80%] rounded-[2px] bg-white" />
            </span>
          </span>
        </div>
        <div className="absolute left-1/2 top-2.5 z-40 h-[28px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
        <div className="absolute inset-x-0 bottom-0 top-11 flex flex-col">{children}</div>
        <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-50 h-1 w-28 -translate-x-1/2 rounded-full bg-white/60" />
      </div>
    </div>
  );
}
