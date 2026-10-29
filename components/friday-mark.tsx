/** Shared vector mark keeps the brand sharp at every screen size. */
export function FridayMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M7 27V5H12V27H7ZM15 5H27L23 10H15V5ZM15 14H24L20 19H15V14Z" fill="currentColor" />
    </svg>
  );
}
