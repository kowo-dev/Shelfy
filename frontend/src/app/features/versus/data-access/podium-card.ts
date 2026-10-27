import type {
  VersusPodiumEntry,
  VersusSessionResult,
} from '@app/core/services/versus/versus.model';
import { imageRendition } from '@shared/utils/image-rendition.util';

const WIDTH = 1200;
const HEIGHT = 630;
const DISPLAY = '"Bricolage Grotesque Variable", "Geist Variable", sans-serif';
const PALETTE = {
  ground: '#08080a',
  cover: '#18181a',
  text: '#f5f5f4',
  textMuted: 'rgba(255, 255, 255, 0.7)',
  textSubtle: 'rgba(255, 255, 255, 0.54)',
  award: '#f3dfae',
  shadow: 'rgba(0, 0, 0, 0.8)',
  wash: (alpha: number) => `rgba(217, 72, 63, ${alpha})`,
} as const;
const BODY = '"Geist Variable", ui-sans-serif, system-ui, sans-serif';

function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = imageRendition(url, 'card');
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.shadowColor = PALETTE.shadow;
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 18;
  roundedRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = PALETTE.cover;
  ctx.fill();
  ctx.restore();
  if (!image) return;
  ctx.save();
  roundedRect(ctx, x, y, w, h, 14);
  ctx.clip();
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

type Ctx = CanvasRenderingContext2D;
type Labels = { byline: string; places: Record<number, string> };

function drawBackground(ctx: Ctx): void {
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const wash = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  wash.addColorStop(0, PALETTE.wash(0.38));
  wash.addColorStop(0.6, PALETTE.wash(0.08));
  wash.addColorStop(1, PALETTE.wash(0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawHeading(ctx: Ctx, result: VersusSessionResult, labels: Labels): void {
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 56px ${DISPLAY}`;
  ctx.fillText(fitText(ctx, result.poolName, 560), 72, 132);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `500 26px ${BODY}`;
  ctx.fillText(fitText(ctx, labels.byline, 560), 72, 178);
}

function drawCovers(ctx: Ctx, images: (HTMLImageElement | null)[]): void {
  const [winnerImage, finalistImage, thirdImage] = images;
  const slots = [
    { image: finalistImage, x: 690, w: 150 },
    { image: thirdImage, x: 1000, w: 130 },
    { image: winnerImage, x: 838, w: 180 },
  ];
  for (const slot of slots) {
    const h = slot.w * 1.5;
    drawCover(ctx, slot.image, slot.x, 470 - h, slot.w, h);
  }
}

function drawPodiumLines(
  ctx: Ctx,
  [winner, finalist, third]: (VersusPodiumEntry | undefined)[],
  labels: Labels,
): void {
  ctx.textAlign = 'left';
  ctx.font = `800 30px ${DISPLAY}`;
  ctx.fillStyle = PALETTE.award;
  ctx.fillText(labels.places[1], 72, 300);
  ctx.font = `600 34px ${BODY}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(fitText(ctx, winner?.entry.title ?? '', 520), 72, 346);
  ctx.font = `500 24px ${BODY}`;
  ctx.fillStyle = PALETTE.textMuted;
  if (finalist)
    ctx.fillText(fitText(ctx, `${labels.places[2]} · ${finalist.entry.title}`, 520), 72, 400);
  if (third) ctx.fillText(fitText(ctx, `${labels.places[3]} · ${third.entry.title}`, 520), 72, 436);
  ctx.font = `800 28px ${DISPLAY}`;
  ctx.fillStyle = PALETTE.textSubtle;
  ctx.fillText('shelfy', 72, 566);
}

export async function renderPodiumCard(result: VersusSessionResult, labels: Labels): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  drawBackground(ctx);
  drawHeading(ctx, result, labels);
  const places = [1, 2, 3].map((place) => result.podium.find((entry) => entry.place === place));
  drawCovers(
    ctx,
    await Promise.all(places.map((entry) => loadImage(entry?.entry.coverUrl ?? null))),
  );
  drawPodiumLines(ctx, places, labels);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
      'image/png',
    ),
  );
}
