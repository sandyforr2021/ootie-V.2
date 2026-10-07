import { describe, expect, it, vi } from 'vitest';
import {
  CLOSET_MEDIA_BUCKET,
  RESUMABLE_UPLOAD_THRESHOLD_BYTES,
  uploadClothingMedia,
  uploadResumableOriginal,
  cleanupUploadedClothingMedia,
  hydratePrivateClothingPhotos,
  getAuthenticatedMediaUserId
} from '../clothingMediaRepository';

const defaultClient = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { auth: { getUser: defaultClient.getUser } } }));

const userId = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';

const prepared = {
  originalFile: new Blob(['original'], { type: 'image/jpeg' }),
  displayBlob: new Blob(['display'], { type: 'image/webp' }),
  originalMimeType: 'image/jpeg',
  displayMimeType: 'image/webp',
  originalBytes: 8,
  width: 1200,
  height: 1600
};

const createClient = ({ failDisplay = false } = {}) => {
  const upload = vi.fn()
    .mockResolvedValueOnce({ data: { path: 'original' }, error: null })
    .mockResolvedValueOnce(failDisplay ? { data: null, error: new Error('storage failed') } : { data: { path: 'display' }, error: null });
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const download = vi.fn().mockResolvedValue({ data: new Blob(['ok']), error: null });
  const bucket = { upload, remove, download };
  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'member-token' } }, error: null })
      },
      storage: { from: vi.fn().mockReturnValue(bucket) }
    },
    bucket
  };
};

describe('clothing media remote lifecycle', () => {
  it('uses the configured authenticated client when the closet delete flow omits a client', async () => {
    defaultClient.getUser.mockResolvedValueOnce({ data: { user: { id: userId } }, error: null });
    await expect(getAuthenticatedMediaUserId()).resolves.toBe(userId);
  });

  it('rejects an expired default session with a login message', async () => {
    defaultClient.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(getAuthenticatedMediaUserId()).rejects.toThrow('登入狀態已失效');
  });

  it('uploads original then derivative, verifies readability, and never upserts', async () => {
    const { client, bucket } = createClient();
    const result = await uploadClothingMedia(itemId, prepared, { operationId }, client);
    expect(client.storage.from).toHaveBeenCalledWith(CLOSET_MEDIA_BUCKET);
    expect(bucket.upload).toHaveBeenCalledTimes(2);
    expect(bucket.upload.mock.calls[0][0]).toContain(`/original.jpg`);
    expect(bucket.upload.mock.calls[1][0]).toContain(`/display.webp`);
    expect(bucket.upload.mock.calls.every((call) => call[2].upsert === false)).toBe(true);
    expect(bucket.download).toHaveBeenCalledWith(result.displayPath);
    expect(result.databaseFields.photo).toBeNull();
  });

  it('cleans the uploaded original if the derivative upload fails', async () => {
    const { client, bucket } = createClient({ failDisplay: true });
    await expect(uploadClothingMedia(itemId, prepared, { operationId }, client)).rejects.toThrow('storage failed');
    expect(bucket.remove).toHaveBeenCalledWith([
      `closet/${userId}/${itemId}/${operationId}/original.jpg`
    ]);
  });

  it('honors cancellation between upload steps and compensates the original', async () => {
    const { client, bucket } = createClient();
    let checks = 0;
    await expect(uploadClothingMedia(itemId, prepared, {
      operationId,
      shouldCancel: () => ++checks > 1
    }, client)).rejects.toMatchObject({ code: 'UPLOAD_CANCELLED' });
    expect(bucket.upload).toHaveBeenCalledTimes(1);
    expect(bucket.remove).toHaveBeenCalledWith([
      `closet/${userId}/${itemId}/${operationId}/original.jpg`
    ]);
  });

  it('uses resumable upload with finite retries and real progress for originals larger than 6 MB', async () => {
    const { client, bucket } = createClient();
    const progress = vi.fn();
    const abortRegistration = vi.fn();
    let capturedOptions;
    class UploadStub {
      constructor(_file, options) {
        capturedOptions = options;
      }
      findPreviousUploads() { return Promise.resolve([]); }
      start() {
        capturedOptions.onProgress(3, 10);
        capturedOptions.onSuccess();
      }
      abort() { return Promise.resolve(); }
    }

    await uploadResumableOriginal('closet/member/item/op/original.jpg', prepared.originalFile, 'image/jpeg', {
      UploadClass: UploadStub,
      onProgress: progress,
      registerAbort: abortRegistration
    }, client);

    expect(capturedOptions.retryDelays).toEqual([0, 3000, 5000]);
    expect(capturedOptions.chunkSize).toBe(RESUMABLE_UPLOAD_THRESHOLD_BYTES);
    expect(capturedOptions.metadata).toMatchObject({
      bucketName: CLOSET_MEDIA_BUCKET,
      objectName: 'closet/member/item/op/original.jpg',
      contentType: 'image/jpeg'
    });
    expect(progress).toHaveBeenCalledWith(3, 10);
    expect(abortRegistration).toHaveBeenLastCalledWith(null);
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it('routes a large original through TUS before uploading the display derivative', async () => {
    const { client, bucket } = createClient();
    class UploadStub {
      constructor(_file, options) { this.options = options; }
      findPreviousUploads() { return Promise.resolve([]); }
      start() { this.options.onSuccess(); }
      abort() { return Promise.resolve(); }
    }
    const largePrepared = {
      ...prepared,
      originalBytes: RESUMABLE_UPLOAD_THRESHOLD_BYTES + 1
    };

    const result = await uploadClothingMedia(itemId, largePrepared, { operationId, UploadClass: UploadStub }, client);

    expect(bucket.upload).toHaveBeenCalledTimes(1);
    expect(bucket.upload.mock.calls[0][0]).toBe(result.displayPath);
    expect(bucket.download).toHaveBeenCalledWith(result.displayPath);
  });

  it('cleans both staged objects when DB save compensation is requested', async () => {
    const { client, bucket } = createClient();
    await cleanupUploadedClothingMedia({ originalPath: 'one', displayPath: 'two' }, client);
    expect(bucket.remove).toHaveBeenCalledWith(['one', 'two']);
  });

  it('hydrates private display paths with revocable browser Object URLs', async () => {
    const { client } = createClient();
    const objectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ootie-private');
    const result = await hydratePrivateClothingPhotos([{ id: itemId, photo_display_path: 'private/display.webp' }], client);
    expect(result[0].photo).toBe('blob:ootie-private');
    expect(objectUrl).toHaveBeenCalled();
  });
});
