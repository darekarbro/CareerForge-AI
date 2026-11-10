const assert = require('node:assert/strict');
// Sample rendered frames while entering/leaving hover. End-state-only scans can
// miss the low contrast produced by interpolating both foreground and background.
module.exports = async (page, button) => {
  const sample = () => button.evaluate((node) => new Promise((resolve) => {
    const luminance = (color) => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const start = performance.now(), ratios = [];
    const frame = () => {
      const style = getComputedStyle(node), foreground = luminance(style.color), background = luminance(style.backgroundColor);
      ratios.push((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05));
      if (performance.now() - start >= 200) resolve({ minimum: Math.min(...ratios), frames: ratios.length });
      else requestAnimationFrame(frame);
    };
    frame();
  }));
  await page.mouse.move(0, 0); await button.hover(); const enter = await sample();
  await page.mouse.move(0, 0); const leave = await sample();
  assert(enter.minimum >= 4.5 && leave.minimum >= 4.5,
    'Button contrast must remain >= 4.5:1 throughout hover: ' + JSON.stringify({ enter, leave }));
  return { enter, leave };
};
