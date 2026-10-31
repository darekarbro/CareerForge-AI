const assert = require('node:assert/strict');

// Sample actual rendered colors throughout the old 150 ms transition window.
// The conflict panel has an opaque white background; include button opacity in
// compositing so a fading but already-enabled action cannot pass accidentally.
module.exports = async (button, state) => {
  const samples = await button.evaluate(async (element) => {
    const result = [], start = performance.now();
    do {
      const style = getComputedStyle(element);
      result.push({ color: style.color, background: style.backgroundColor, opacity: Number(style.opacity) });
      await new Promise(requestAnimationFrame);
    } while (performance.now() - start < 250);
    return result;
  });
  const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  const luminance = (channels) => channels.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const composite = (value, opacity) => rgb(value).map((channel) => channel * opacity + 255 * (1 - opacity));
  const ratios = samples.map((sample) => {
    const a = luminance(composite(sample.color, sample.opacity)), b = luminance(composite(sample.background, sample.opacity));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  const minimum = Math.min(...ratios);
  assert(minimum >= 4.5, state + ': conflict action contrast dipped to ' + minimum.toFixed(2) + ':1');
  console.log('CONTRAST ' + state + ': minimum ' + minimum.toFixed(2) + ':1 across ' + samples.length + ' frames');
};
