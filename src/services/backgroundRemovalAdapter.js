export const BACKGROUND_REMOVAL_STATUS = Object.freeze({
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  UNAVAILABLE: 'UNAVAILABLE',
  ORIGINAL: 'ORIGINAL'
});

/**
 * Provider-neutral boundary for future background removal. No provider is
 * configured in this batch, so it never pretends that the original is
 * processed output.
 */
export const backgroundRemovalAdapter = Object.freeze({
  isBackgroundRemovalAvailable: () => false,
  async process(image) {
    if (!image) {
      return {
        status: BACKGROUND_REMOVAL_STATUS.FAILURE,
        image: null,
        error: new Error('IMAGE_REQUIRED')
      };
    }
    return {
      status: BACKGROUND_REMOVAL_STATUS.UNAVAILABLE,
      image,
      error: new Error('BACKGROUND_REMOVAL_NOT_CONFIGURED')
    };
  }
});

export const isBackgroundRemovalAvailable = () => backgroundRemovalAdapter.isBackgroundRemovalAvailable();
