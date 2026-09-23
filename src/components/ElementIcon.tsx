/**
 * The element logo that replaced the old coloured dot everywhere.
 *
 * It lives in its own file because SingleCalculator is now the only caller:
 * the team calculator this was written for was removed in 6bbdfdf, and the
 * 1,100-line component it left behind was kept alive by this one import.
 */
export function ElementIcon({ el, className = 'h-4 w-4' }: { el: string; className?: string }) {
  if (el === 'physical') {
    return <span className={`element-dot bg-physical ${className}`} aria-hidden="true" />;
  }
  return (
    <img
      src={`/images/element-${el}.webp`}
      alt=""
      width="120"
      height="120"
      className={`rounded-full bg-white object-contain p-px shadow-sm ring-1 ring-black/5 ${className}`}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
    />
  );
}
