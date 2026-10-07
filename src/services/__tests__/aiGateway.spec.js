import { describe, expect, it, vi } from 'vitest';
import { AI_ERROR_MESSAGE, AiGatewayError, createAiGatewayClient, getAiErrorMessage } from '../aiGateway';

describe('OOTIE AI Gateway browser client', () => {
  it('surfaces provider safety rejection with the dedicated UI message', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'SAFETY_REJECTION', message: 'blocked' } })
    }));
    const client = createAiGatewayClient({ baseUrl: 'https://gateway.example', fetchImpl });
    await expect(client.generateOutfitPreview('token', {})).rejects.toMatchObject({ code: 'SAFETY_REJECTION' });
    expect(getAiErrorMessage(new AiGatewayError('SAFETY_REJECTION'))).toBe(AI_ERROR_MESSAGE.SAFETY_REJECTION);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failed generation request', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: { code: 'PROVIDER_UNAVAILABLE' } })
    }));
    const client = createAiGatewayClient({ baseUrl: 'https://gateway.example', fetchImpl });
    await expect(client.generateSingleGarmentTryOn('token', {})).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('explains the provider age restriction only when a diagnostic reason exists', () => {
    const error = new AiGatewayError('SAFETY_REJECTION', 'blocked', 422, { safetyReason: 'AGE_RESTRICTED' });
    expect(getAiErrorMessage(error)).toContain('Google 將輸入或生成結果判為不符合成人限制');
    expect(getAiErrorMessage(new AiGatewayError('SAFETY_REJECTION'))).toContain('尚未提供具體原因');
  });

  it('distinguishes a public figure restriction from general content filtering', () => {
    expect(getAiErrorMessage(new AiGatewayError('SAFETY_REJECTION', '', 422, {
      safetyReason: 'PUBLIC_FIGURE_RESTRICTED'
    }))).toContain('受限制的公眾人物影像');
    expect(getAiErrorMessage(new AiGatewayError('SAFETY_REJECTION', '', 422, {
      safetyReason: 'CONTENT_FILTERED'
    }))).toContain('可能涉及人物照、衣物照或生成結果');
  });

  it('requires a member access token before network access', async () => {
    const fetchImpl = vi.fn();
    const client = createAiGatewayClient({ baseUrl: 'https://gateway.example', fetchImpl });
    await expect(client.generateSingleGarmentTryOn('', {})).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('loads private media through an authenticated no-cookie Gateway request', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:private-result');
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(['private-image'], { type: 'image/png' })
    }));
    try {
      const client = createAiGatewayClient({ baseUrl: 'https://gateway.example', fetchImpl });
      await expect(client.loadPrivateImage('member-token', 'ai-generated/user/generation/result.png')).resolves.toBe('blob:private-result');
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://gateway.example/v1/private-images/ai-generated%2Fuser%2Fgeneration%2Fresult.png',
        expect.objectContaining({ headers: { Authorization: 'Bearer member-token' } })
      );
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
    }
  });

  it('deletes a person photo through an authenticated DELETE request', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'demo-photo', deleted: true })
    }));
    const client = createAiGatewayClient({ baseUrl: 'https://gateway.example', fetchImpl });

    await expect(client.deletePersonPhoto('member-token', 'demo-photo')).resolves.toMatchObject({ deleted: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gateway.example/v1/person-photos/demo-photo',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer member-token' }
      })
    );
  });

  it('names the exact garment when the Gateway rejects its image derivative', () => {
    expect(getAiErrorMessage(new AiGatewayError(
      'CLOTHING_IMAGE_INVALID',
      'invalid garment',
      422,
      { itemName: '條紋針織上衣' }
    ))).toContain('「條紋針織上衣」');
  });
});
