import { randomUUID } from 'node:crypto';

export class CommerceJobWorker {
  constructor({ repository, provider, storage, now = () => new Date() }) {
    this.repository = repository;
    this.provider = provider;
    this.storage = storage;
    this.now = now;
  }

  async tick() {
    const lease = randomUUID();
    const job = await this.repository.claim(lease);
    if (!job) return false;
    const update = (changes) => this.repository.updateJob(job.id, lease, changes);
    let submitting = false;
    try {
      if (!job.provider_task_id) {
        const person = await this.storage.downloadPrivate(job.person_path);
        const src = await this.provider.upload(person, 'person.jpg');
        const ref = job.kind === 'try_on'
          ? await this.provider.upload(await this.storage.downloadPrivate(job.product_path), 'garment.jpg') : null;
        await update({ status: 'submitting' });
        submitting = true;
        const taskId = await this.provider.submit(job, src, ref);
        await update({ status: 'processing', provider_task_id: taskId, lease_token: null, lease_until: null, next_poll_at: new Date(+this.now() + 10000).toISOString() });
        return true;
      }
      const result = await this.provider.poll(job);
      if (result?.task_status === 'error') {
        const noFace = /no face was detected/i.test(String(result.error_message || result.error || ''));
        await update({ status: 'failed', error_code: noFace ? 'YOUCAM_FACE_NOT_DETECTED' : 'YOUCAM_TASK_FAILED', completed_at: this.now().toISOString(), lease_token: null, lease_until: null });
      } else if (result?.task_status === 'success') {
        let resultPath = null;
        let resultData = null;
        if (job.kind === 'try_on') {
          const image = await this.provider.resultImage(result);
          resultPath = `ai-generated/${job.user_id}/${job.id}.jpg`;
          await this.storage.uploadPrivate(resultPath, image, { upsert: true });
        } else {
          const colors = result?.results?.color;
          if (!/^#[\da-f]{6}$/i.test(colors?.skin_color || '')) throw new Error('Invalid skin-tone result');
          resultData = Object.fromEntries(['skin_color','hair_color','eye_color','lip_color','eyebrow_color'].filter((key) => /^#[\da-f]{6}$/i.test(colors[key] || '')).map((key) => [key, colors[key]]));
        }
        await update({ status: 'succeeded', result_path: resultPath, result_data: resultData, completed_at: this.now().toISOString(), lease_token: null, lease_until: null });
      } else {
        if (!['running','pending','queued'].includes(result?.task_status)) throw new Error('Unknown task state');
        if (+this.now() - Date.parse(job.created_at) > 86400000) throw new Error('Task exceeded review window');
        await update({ next_poll_at: new Date(+this.now() + 10000).toISOString(), lease_token: null, lease_until: null });
      }
    } catch (error) {
      if (submitting && error?.requestNotSent === true) {
        await update({ status: 'failed', error_code: error.code, completed_at: this.now().toISOString(), lease_token: null, lease_until: null }).catch(() => {});
      } else if (submitting) {
        // Includes task-ID persistence failures: never submit this job again.
        await update({ status: 'needs_review', error_code: 'SUBMISSION_UNCERTAIN', lease_token: null, lease_until: null }).catch(() => {});
      } else if (job.provider_task_id) {
        const failures = job.poll_errors + 1;
        await update({ status: failures >= 20 ? 'needs_review' : 'processing', error_code: 'RESULT_CHECK_PENDING', poll_errors: failures,
          next_poll_at: new Date(+this.now() + Math.min(60000, failures * 10000)).toISOString(), lease_token: null, lease_until: null }).catch(() => {});
      } else {
        await update({ status: 'failed', error_code: error?.code || 'IMAGE_PREPARATION_FAILED', completed_at: this.now().toISOString(), lease_token: null, lease_until: null }).catch(() => {});
      }
    }
    return true;
  }
}

export function startCommerceWorker(worker, { onError = () => {}, intervalMs = 2000, idleIntervalMs = 10000 } = {}) {
  let stopped = false;
  let timer;
  const run = async () => {
    if (stopped) return;
    let found=false;
    try { found=await worker.tick(); } catch (error) { onError(error); }
    if (!stopped) timer = setTimeout(run, found?intervalMs:idleIntervalMs);
  };
  void run();
  return () => { stopped = true; clearTimeout(timer); };
}
