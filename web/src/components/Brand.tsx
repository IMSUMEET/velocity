export function Brand({ size = 34 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid place-items-center rounded-xl bg-gradient-to-br from-accent to-batch shadow-card"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2-6 4 12 2-6h6" />
        </svg>
      </div>
      <div className="leading-none">
        <div className="text-[15px] font-bold tracking-tight text-ink">
          Velo<span className="text-accent">City</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Dispatch Strategy Lab</div>
      </div>
    </div>
  );
}
