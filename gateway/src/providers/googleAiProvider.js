export class GoogleAiProvider {
  constructor({ stylingProvider, vtoProvider, imageProvider, configuration }) {
    this.stylingProvider = stylingProvider;
    this.vtoProvider = vtoProvider;
    this.imageProvider = imageProvider;
    this.configuration = configuration;
  }

  recommendOutfit(input) {
    return this.stylingProvider.recommendOutfit(input);
  }

  generateSingleGarmentTryOn(input) {
    return this.vtoProvider.generateSingleGarmentTryOn(input);
  }

  generateOutfitPreview(input) {
    return this.imageProvider.generateOutfitPreview(input);
  }

  async healthCheck() {
    return {
      provider: 'google_cloud',
      configured: Boolean(
        this.configuration?.projectId
        && this.configuration?.stylingModel
        && this.configuration?.vtoModel
        && this.configuration?.imageModel
      )
    };
  }
}
