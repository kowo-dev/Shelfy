const SCROLL_SETTLE_MS = 150;
const TAP_SLOP_PX = 10;

export function guardTapsWhileScrolling(doc: Document, now = () => performance.now()): () => void {
  let lastScrollAt = -Infinity;
  let startX = 0;
  let startY = 0;
  let suppress = false;

  const onScroll = (): void => {
    lastScrollAt = now();
  };
  const onPointerDown = (event: PointerEvent): void => {
    startX = event.clientX;
    startY = event.clientY;
    suppress = event.pointerType === 'touch' && now() - lastScrollAt < SCROLL_SETTLE_MS;
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || suppress) return;
    suppress = Math.hypot(event.clientX - startX, event.clientY - startY) > TAP_SLOP_PX;
  };
  const onClick = (event: MouseEvent): void => {
    if (!suppress || event.detail === 0) return;
    suppress = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const capture = { capture: true, passive: true };
  doc.addEventListener('scroll', onScroll, capture);
  doc.addEventListener('pointerdown', onPointerDown, capture);
  doc.addEventListener('pointermove', onPointerMove, capture);
  doc.addEventListener('click', onClick, true);
  return () => {
    doc.removeEventListener('scroll', onScroll, capture);
    doc.removeEventListener('pointerdown', onPointerDown, capture);
    doc.removeEventListener('pointermove', onPointerMove, capture);
    doc.removeEventListener('click', onClick, true);
  };
}
