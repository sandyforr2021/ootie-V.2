import { MetadataAccessTokenProvider } from '../googleAuth.js';
import { GoogleVertexClient } from './googleVertexClient.js';
import { GoogleStylingProvider } from './googleStylingProvider.js';
import { GoogleVtoProvider } from './googleVtoProvider.js';
import { GoogleNanoBananaProvider } from './googleNanoBananaProvider.js';
import { GoogleAiProvider } from './googleAiProvider.js';

export function createGoogleAiProvider(config, dependencies = {}) {
  const tokenProvider = dependencies.tokenProvider || new MetadataAccessTokenProvider({
    fetchImpl: dependencies.fetchImpl || fetch
  });
  const vertexClient = dependencies.vertexClient || new GoogleVertexClient({
    projectId: config.google.projectId,
    tokenProvider,
    fetchImpl: dependencies.fetchImpl || fetch
  });
  return new GoogleAiProvider({
    stylingProvider: new GoogleStylingProvider({
      vertexClient,
      model: config.google.stylingModel,
      location: config.google.stylingLocation
    }),
    vtoProvider: new GoogleVtoProvider({
      vertexClient,
      model: config.google.vtoModel,
      location: config.google.vtoLocation
    }),
    imageProvider: new GoogleNanoBananaProvider({
      vertexClient,
      model: config.google.imageModel,
      location: config.google.imageLocation,
      outputSize: config.google.imageOutputSize
    }),
    configuration: config.google
  });
}
