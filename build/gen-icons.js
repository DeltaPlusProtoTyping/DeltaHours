const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIcoModule = require("png-to-ico");
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const buildDir = __dirname;
const svg = fs.readFileSync(path.join(buildDir, "icon.svg"));

const icoSizes = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  // Full-size PNG (electron-builder uses this for mac/linux and window icon)
  await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(path.join(buildDir, "icon.png"));

  // Render each size for the .ico, then bundle them
  const buffers = [];
  for (const size of icoSizes) {
    buffers.push(await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer());
  }
  const ico = await pngToIco(buffers);
  fs.writeFileSync(path.join(buildDir, "icon.ico"), ico);

  console.log("Wrote icon.png (512) and icon.ico (" + icoSizes.join(",") + ")");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
