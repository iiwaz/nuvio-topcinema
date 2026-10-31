const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const sourceDir = path.join(root, "src", "topcinema");
const distDir = path.join(root, "dist");
const providerDir = path.join(distDir, "providers");

async function main() {
  const scraper = JSON.parse(fs.readFileSync(path.join(sourceDir, "scraper.json"), "utf8"));
  fs.mkdirSync(providerDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(sourceDir, "index.js")],
    outfile: path.join(providerDir, "topcinema.js"),
    bundle: true,
    format: "cjs",
    platform: "neutral",
    target: "es2016",
    sourcemap: false,
    external: ["cheerio-without-node-native", "react-native-cheerio", "cheerio", "crypto-js", "axios"]
  });

  const manifest = {
    name: "Nuvio TopCinema",
    version: "1.0.0",
    description: "TopCinema provider for Nuvio",
    scrapers: [{
      id: scraper.id,
      name: scraper.name,
      description: scraper.description,
      version: scraper.version,
      author: scraper.author,
      supportedTypes: scraper.supportedTypes,
      filename: "providers/topcinema.js",
      enabled: scraper.enabled !== false,
      logo: scraper.logo || "",
      contentLanguage: scraper.contentLanguage || ["ar", "en"],
      formats: scraper.formats || ["hls", "mp4"],
      limited: !!scraper.limited,
      disabledPlatforms: scraper.disabledPlatforms || [],
      supportsExternalPlayer: scraper.supportsExternalPlayer !== false
    }]
  };

  fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("Build completed: dist/manifest.json and dist/providers/topcinema.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
