// One local inference at a time, including upload forms and clothing previews.
// Only model weights are cached by Transformers.js; photo results are in memory.
let worker, active, sequence = 0, idleTimer;
const queue = [];
function releaseWorker() { worker?.terminate(); worker = null; }
function pump() {
  if (active) return;
  const job = queue.shift();
  if (!job) { idleTimer = setTimeout(releaseWorker, 45000); return; }
  clearTimeout(idleTimer);
  active = job;
  try {
    worker ||= new Worker(new URL('../workers/clothingCutout.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (active?.id !== data.id) return;
      if (data.state === 'done') finish(null, data.result);
      else if (data.state === 'error') { if (import.meta.env.DEV) console.warn('Local cutout:', data.code); releaseWorker(); finish(new Error('CUTOUT_UNAVAILABLE')); }
      else active.onState(data.state);
    };
    worker.onerror = () => { releaseWorker(); finish(new Error('CUTOUT_UNAVAILABLE')); };
    job.timer = setTimeout(() => { releaseWorker(); finish(new Error('CUTOUT_TIMEOUT')); }, 240000);
    job.onState('loading');
    worker.postMessage({ id: job.id, blob: job.blob, category: job.category });
  } catch (error) { finish(error); }
}
function finish(error, result) {
  const job = active;
  if (!job) return;
  active = null;
  clearTimeout(job.timer);
  job.signal?.removeEventListener('abort', job.abort);
  if (error) job.reject(error); else job.resolve(result);
  pump();
}
export function removeClothingBackground(blob, { signal, onState = () => {}, preview = false, category = '' } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const job = { id: ++sequence, blob, signal, onState, resolve, reject, category, preview };
    job.abort = () => {
      const error = new DOMException('Cancelled', 'AbortError');
      if (active === job) { releaseWorker(); finish(error); }
      else { const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1); signal?.removeEventListener('abort', job.abort); reject(error); }
    };
    signal?.addEventListener('abort', job.abort, { once: true });
    onState('queued');
    const firstPreview = queue.findIndex(pending => pending.preview);
    if (!preview && firstPreview >= 0) queue.splice(firstPreview, 0, job); else queue.push(job);
    pump();
  });
}

const previews = new Map();
export function clothingCutoutPreview(src, category = '') {
  const key = `${src}|${category}`;
  if (!previews.has(key)) {
    const result = fetch(src).then(response => {
      if (!response.ok) throw new Error('IMAGE_UNAVAILABLE');
      return response.blob();
    }).then(blob => removeClothingBackground(blob, {preview:true,category}));
    previews.set(key, result);
    result.catch(() => previews.delete(key));
    if (previews.size > 16) previews.delete(previews.keys().next().value);
  }
  return previews.get(key);
}
