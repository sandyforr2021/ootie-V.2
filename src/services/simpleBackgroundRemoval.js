// A conservative flood fill for near-uniform backgrounds. This is not an AI
// segmentation model: its result must be reviewed and is never applied by default.
export function removeUniformBackground({ pixels, width, height }) {
  const count = width * height;
  if (!count || pixels.length !== count * 4 || width < 4 || height < 4) return null;
  const edge = [];
  const add = (x, y) => { const i = (y * width + x) * 4; if (pixels[i + 3] >= 240) edge.push(i); };
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 100));
  for (let x = 0; x < width; x += stride) { add(x, 0); add(x, height - 1); }
  for (let y = 0; y < height; y += stride) { add(0, y); add(width - 1, y); }
  if (edge.length < 8) return null;
  const sample = edge[0];
  const distance = (i) => Math.max(Math.abs(pixels[i] - pixels[sample]), Math.abs(pixels[i + 1] - pixels[sample + 1]), Math.abs(pixels[i + 2] - pixels[sample + 2]));
  if (edge.filter((i) => distance(i) <= 20).length / edge.length < 0.9) return null;
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let head = 0, tail = 0;
  const enqueue = (pos) => {
    if (visited[pos]) return;
    visited[pos] = 1;
    const i = pos * 4;
    if (pixels[i + 3] >= 240 && distance(i) <= 24) queue[tail++] = pos;
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const pos = queue[head++], x = pos % width, y = Math.floor(pos / width);
    if (x > 0) enqueue(pos - 1);
    if (x + 1 < width) enqueue(pos + 1);
    if (y > 0) enqueue(pos - width);
    if (y + 1 < height) enqueue(pos + width);
  }
  // Avoid blank images and cases where the detected region is negligible.
  if (tail / count < 0.1 || tail / count > 0.9) return null;
  const result = new Uint8ClampedArray(pixels);
  for (let index = 0; index < tail; index++) result[queue[index] * 4 + 3] = 0;
  return result;
}

export async function removeSimpleBackground(blob) {
  if (typeof createImageBitmap !== 'function') return null;
  const image = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = removeUniformBackground({ pixels: data.data, width: canvas.width, height: canvas.height });
    if (!result) return null;
    data.data.set(result);
    context.putImageData(data, 0, 0);
    // PNG guarantees alpha support even in browsers without WebP encoding.
    const displayBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return displayBlob && displayBlob.size <= 6 * 1024 * 1024
      ? { displayBlob, width: canvas.width, height: canvas.height }
      : null;
  } finally { image.close?.(); }
}
