// Warwickly branding, shared with warwickly.com. The mark is near-black with purple
// accents, so dark themes get a light-ink copy (public/brand/warwickly-w-light.png).
const WARWICKLY = "https://warwickly.com/?utm_source=covcrimeinfo&utm_medium=referral&utm_campaign=made_by";

export function WarwicklyMark({ height = 32, className = "" }: { height?: number; className?: string }) {
  const width = Math.round((height * 182) / 96);
  return (
    <span className={`wk-mark ${className}`} style={{ width, height }} aria-hidden="true">
      <img className="wk-ink-dark" src="/brand/warwickly-w.png" width={width} height={height} alt="" />
      <img className="wk-ink-light" src="/brand/warwickly-w-light.png" width={width} height={height} alt="" />
    </span>
  );
}

export function MadeByWarwickly({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`made-by${compact ? " compact" : ""}`} href={WARWICKLY} target="_blank" rel="noopener">
      <WarwicklyMark height={compact ? 14 : 18} />
      <span>
        Made by <strong>Warwickly</strong>
      </span>
    </a>
  );
}
