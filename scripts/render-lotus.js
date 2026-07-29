const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SVG = path.join(ROOT, 'assets', 'lotus.svg');
const ORIG = path.join(ROOT, 'assets', 'icon-7.png');
const OUT = path.join(ROOT, 'assets', 'lotus-render.png');

function silhouette(data, width, height, channels) {
  const rows = {};
  for (let y = 0; y < height; y++) {
    let min = -1, max = -1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const bri = data[i] + data[i + 1] + data[i + 2];
      const a = channels === 4 ? data[i + 3] : 255;
      if (a > 20 && bri > 40) {
        if (min === -1) min = x;
        max = x;
      }
    }
    if (min !== -1) rows[y] = [min, max];
  }
  return rows;
}

(async () => {
  const svgBuf = fs.readFileSync(SVG);
  const rendered = await sharp(svgBuf)
    .resize(256, 256)
    .flatten({ background: '#000000' })
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  await sharp(svgBuf).resize(256, 256).flatten({ background: '#000000' }).png().toFile(OUT);

  const orig = await sharp(ORIG).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const mine = silhouette(rendered.data, rendered.info.width, rendered.info.height, rendered.info.channels);
  const theirs = silhouette(orig.data, orig.info.width, orig.info.height, orig.info.channels);

  console.log('  y | original L-R (w) | mine L-R (w) | dL dR');
  let totalErr = 0, count = 0;
  for (let y = 38; y <= 216; y += 6) {
    const o = theirs[y];
    const m = mine[y];
    const os = o ? `${o[0]}-${o[1]} (${o[1] - o[0]})` : '--';
    const ms = m ? `${m[0]}-${m[1]} (${m[1] - m[0]})` : '--';
    let d = '';
    if (o && m) {
      d = `${m[0] - o[0]} ${m[1] - o[1]}`;
      totalErr += Math.abs(m[0] - o[0]) + Math.abs(m[1] - o[1]);
      count++;
    } else if (o || m) {
      totalErr += 60; count++;
    }
    console.log(String(y).padStart(4), '|', os.padEnd(16), '|', ms.padEnd(14), '|', d);
  }
  console.log('mean edge error:', (totalErr / (count * 2)).toFixed(2), 'px');
})().catch((e) => { console.error(e); process.exit(1); });
