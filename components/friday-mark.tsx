/** Shared vector mark keeps the brand sharp at every screen size. */
export function FridayMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M8 26V6H25L21 11H14V15H23L19 20H14V26H8Z" fill="currentColor" />
      <path d="M25 21L26.4 24.6L30 26L26.4 27.4L25 31L23.6 27.4L20 26L23.6 24.6L25 21Z" fill="currentColor" opacity=".65" />
    </svg>
  );
}
