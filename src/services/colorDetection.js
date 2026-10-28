import { colorHexValues, getColorFamilyForPrimaryColor } from '@/constants';

const supportedColors = Object.entries(colorHexValues).map(([name, hex]) => ({
  name,
  rgb: hexToRgb(hex)
}));

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return null;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

const rgbToHsl = (r, g, b) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = max === red ? ((green-blue)/delta)%6 : max===green ? (blue-red)/delta+2 : (red-green)/delta+4;
  hue=((hue*60)+360)%360;
  return { hue, saturation, lightness };
};
const nearestSupportedColor = (pixel) => {
  const { r, g, b } = pixel;
  return supportedColors.reduce((closest, candidate) => {
    if (!candidate.rgb) return closest;
    const sourceHsl=rgbToHsl(r,g,b), targetHsl=rgbToHsl(candidate.rgb.r,candidate.rgb.g,candidate.rgb.b);
    const difference=Math.abs(sourceHsl.hue-targetHsl.hue);
    const hueDistance=Math.min(difference,360-difference)/180;
    // Saturated dark denim/plum should not collapse to neutral gray/black.
    const colorful=Math.max(r,g,b)-Math.min(r,g,b)>18 && sourceHsl.saturation>0.15;
    const distance=colorful
      ? hueDistance**2*25000 + (sourceHsl.saturation-targetHsl.saturation)**2*3000 + (sourceHsl.lightness-targetHsl.lightness)**2*5000 + (targetHsl.saturation<0.12?18000:0)
      : (r-candidate.rgb.r)**2+(g-candidate.rgb.g)**2+(b-candidate.rgb.b)**2;
    return !closest || distance < closest.distance
      ? { name: candidate.name, distance }
      : closest;
  }, null)?.name || null;
};

const fallbackGrayColor = ({ r, g, b }) => {
  const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / (2 * 255);
  if (lightness < 0.18) return '黑色';
  if (lightness < 0.5) return '炭灰色';
  if (lightness > 0.9) return '白色';
  return '米白色';
};

/**
 * Analyze raw RGBA pixels without relying on a browser canvas. Bright,
 * low-saturation background pixels are ignored before the nearest supported
 * OOTIE color is selected.
 */
export const analyzePixelData = (pixels, width, height) => {
  if (!pixels || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const expectedLength = width * height * 4;
  if (pixels.length < expectedLength) return null;

  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 2500)));
  const scores = new Map();
  const fallbackPixels = [];
  let candidateCount = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      if (alpha < 32) continue;

      const pixel = {
        r: pixels[offset],
        g: pixels[offset + 1],
        b: pixels[offset + 2]
      };
      fallbackPixels.push(pixel);

      const { saturation, lightness } = rgbToHsl(pixel.r, pixel.g, pixel.b);
      const isBrightBackground = lightness > 0.94 && saturation < 0.14;
      if (isBrightBackground) continue;

      const color = saturation < 0.08
        ? fallbackGrayColor(pixel)
        : nearestSupportedColor(pixel);
      if (!color) continue;

      const chroma=Math.max(pixel.r,pixel.g,pixel.b)-Math.min(pixel.r,pixel.g,pixel.b);
      const centerWeight=1+2*(1-Math.abs(2*x/Math.max(1,width-1)-1))*(1-Math.abs(2*y/Math.max(1,height-1)-1));
      const weight = centerWeight * (chroma>18 ? 1+saturation*2 : 0.2);
      scores.set(color, (scores.get(color) || 0) + weight);
      candidateCount += 1;
    }
  }

  if (candidateCount === 0) {
    fallbackPixels.forEach((pixel) => {
      const color = fallbackGrayColor(pixel);
      scores.set(color, (scores.get(color) || 0) + 1);
    });
  }

  if (!scores.size) return null;

  const primaryColor = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])[0][0];
  return {
    primaryColor,
    colorFamily: getColorFamilyForPrimaryColor(primaryColor)
  };
};

/** Analyze a browser image source. Failures return null so the form remains usable. */
export const analyzeImageColor = (source) => {
  if (!source || typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDimension = 160;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(analyzePixelData(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height));
      } catch (error) {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
};
