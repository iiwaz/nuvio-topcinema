var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/topcinema/index.js
var BASE_URL = "https://web6.topcinema.fan";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36";
function log(message) {
  try {
    console.log("[TopCinema] " + message);
  } catch (_) {
  }
}
function decodeHtml(value) {
  return String(value || "").replace(/&amp;/gi, "&").replace(/&#038;/g, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&nbsp;/gi, " ");
}
function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function normalize(value) {
  return stripTags(value).toLowerCase().replace(/[أإآ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim();
}
function absoluteUrl(value, base) {
  const url = decodeHtml(String(value || "").trim()).replace(/&amp;/g, "&");
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  const origin = (base || BASE_URL).match(/^https?:\/\/[^/]+/i);
  if (!origin) return "";
  if (url.charAt(0) === "/") return origin[0] + url;
  const cleanBase = String(base || BASE_URL).replace(/[?#].*$/, "");
  return cleanBase.slice(0, cleanBase.lastIndexOf("/") + 1) + url;
}
function attr(tag, name) {
  const re = new RegExp("\\b" + name + `\\s*=\\s*(['"])([\\s\\S]*?)\\1`, "i");
  const match = String(tag || "").match(re);
  return match ? decodeHtml(match[2]) : "";
}
function getText(url, headers) {
  return __async(this, null, function* () {
    const response = yield fetch(url, {
      method: "GET",
      headers: headers || {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
      },
      redirect: "follow"
    });
    if (!response || !response.ok) throw new Error("HTTP " + (response ? response.status : "unknown"));
    return response.text();
  });
}
function getMetadata(tmdbId, mediaType) {
  return __async(this, null, function* () {
    let key = "";
    try {
      if (typeof TMDB_API_KEY !== "undefined") key = TMDB_API_KEY;
    } catch (_) {
    }
    try {
      if (!key && typeof globalThis !== "undefined") key = globalThis.TMDB_API_KEY || "";
    } catch (_) {
    }
    if (!key) throw new Error("TMDB API key is not exposed by this Nuvio runtime.");
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = "https://api.themoviedb.org/3/" + type + "/" + encodeURIComponent(String(tmdbId)) + "?api_key=" + encodeURIComponent(key) + "&language=en-US";
    const response = yield fetch(url, { headers: { "Accept": "application/json", "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error("TMDB returned HTTP " + response.status);
    const data = yield response.json();
    return {
      title: type === "tv" ? data.name || data.original_name : data.title || data.original_title,
      originalTitle: type === "tv" ? data.original_name : data.original_title,
      year: String((type === "tv" ? data.first_air_date : data.release_date) || "").slice(0, 4)
    };
  });
}
function findSearchCandidates(html, expectedTitle, year) {
  const results = [];
  const re = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let match;
  const expected = normalize(expectedTitle);
  while ((match = re.exec(html)) !== null) {
    const opening = match[0].match(/^<a\b[^>]*>/i);
    if (!opening) continue;
    const href = absoluteUrl(attr(opening[0], "href"), BASE_URL);
    const title = stripTags(match[0]);
    if (!href || !title || !/topcinema\.fan$/i.test((href.match(/^https?:\/\/([^/]+)/i) || [])[1] || "")) continue;
    if (/\/(category|tag|author|page)\//i.test(href)) continue;
    const haystack = normalize(title + " " + href);
    const tokens = expected.split(" ").filter(Boolean);
    let hits = 0;
    for (let i = 0; i < tokens.length; i++) if (haystack.indexOf(tokens[i]) >= 0) hits++;
    let score = tokens.length ? hits / tokens.length * 70 : 0;
    if (haystack.indexOf(expected) >= 0) score += 25;
    if (year) score += haystack.indexOf(year) >= 0 ? 20 : -5;
    if (score >= 45) results.push({ url: href.split("#")[0], score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}
function searchTopCinema(title, year) {
  return __async(this, null, function* () {
    const searchUrl = BASE_URL + "/?s=" + encodeURIComponent(title);
    const html = yield getText(searchUrl);
    const candidates = findSearchCandidates(html, title, year);
    return candidates.length ? candidates[0].url : "";
  });
}
function findEpisodeLink(html, base, season, episode) {
  const re = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let match;
  const episodeNumber = String(episode);
  const seasonNumber = String(season);
  const patterns = [
    new RegExp("s0*" + seasonNumber + "[ ._-]*e0*" + episodeNumber, "i"),
    new RegExp("season[ ._-]*0*" + seasonNumber + ".*episode[ ._-]*0*" + episodeNumber, "i"),
    new RegExp("(episode|ep)[ ._-]*0*" + episodeNumber + "(\\D|$)", "i"),
    new RegExp("(\u0627\u0644\u062D\u0644\u0642\u0629|\u062D\u0644\u0642\u0629)[^0-9]{0,8}0*" + episodeNumber + "(\\D|$)", "i")
  ];
  while ((match = re.exec(html)) !== null) {
    const opening = match[0].match(/^<a\b[^>]*>/i);
    if (!opening) continue;
    const label = normalize(stripTags(match[0]) + " " + attr(opening[0], "href"));
    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(label)) return absoluteUrl(attr(opening[0], "href"), base);
    }
  }
  return "";
}
function getIframe(html, base) {
  const re = /<iframe\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const src = absoluteUrl(attr(match[0], "src"), base);
    if (src && !/(youtube|facebook|google)/i.test(src)) return src;
  }
  return "";
}
function findVideoUrls(source, base) {
  const text = String(source || "").replace(/\\\//g, "/").replace(/&amp;/g, "&");
  const urls = [];
  const re = /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>\\]*)?/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (urls.indexOf(match[0]) < 0) urls.push(match[0]);
  }
  const quoted = /(?:src|file|source|hls|url)\s*[:=]\s*['"]([^'"]+?\.(?:m3u8|mp4)(?:\?[^'"]*)?)['"]/gi;
  while ((match = quoted.exec(text)) !== null) {
    const url = absoluteUrl(match[1], base);
    if (url && urls.indexOf(url) < 0) urls.push(url);
  }
  return urls;
}
function parseMasterPlaylist(text, masterUrl) {
  const lines = String(text || "").split(/\r?\n/);
  const streams = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.indexOf("#EXT-X-STREAM-INF:") !== 0) continue;
    const resolution = (line.match(/RESOLUTION=(\d+x\d+)/i) || [])[1] || "";
    const bandwidth = parseInt((line.match(/BANDWIDTH=(\d+)/i) || [])[1] || "0", 10);
    let next = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() && lines[j].trim().charAt(0) !== "#") {
        next = lines[j].trim();
        break;
      }
    }
    if (next) streams.push({ url: absoluteUrl(next, masterUrl), resolution, bandwidth });
  }
  streams.sort((a, b) => b.bandwidth - a.bandwidth);
  return streams;
}
function streamsFromPlayer(embedUrl) {
  return __async(this, null, function* () {
    const html = yield getText(embedUrl, {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      "Referer": "https://down.vidtube.one/"
    });
    let videoUrls = findVideoUrls(html, embedUrl);
    if (!videoUrls.length) {
      const scriptRe = /<script\b[^>]*src=['"]([^'"]+)['"][^>]*>/gi;
      let match;
      let count = 0;
      while ((match = scriptRe.exec(html)) !== null && count < 5 && !videoUrls.length) {
        count++;
        try {
          const scriptUrl = absoluteUrl(match[1], embedUrl);
          const script = yield getText(scriptUrl, { "User-Agent": USER_AGENT, "Referer": embedUrl });
          videoUrls = findVideoUrls(script, scriptUrl);
        } catch (_) {
        }
      }
    }
    const headers = {
      "User-Agent": USER_AGENT,
      "Referer": embedUrl,
      "Origin": "https://down.vidtube.one"
    };
    const output = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      if (/\.m3u8(?:\?|$)/i.test(url)) {
        try {
          const response = yield fetch(url, { headers, redirect: "follow" });
          if (response.ok) {
            const playlist = yield response.text();
            const variants = parseMasterPlaylist(playlist, url);
            if (variants.length) {
              for (let j = 0; j < variants.length; j++) {
                const quality = variants[j].resolution || (variants[j].bandwidth ? Math.round(variants[j].bandwidth / 1e3) + "kbps" : "HLS");
                output.push({
                  name: "TopCinema",
                  title: quality + (j === 0 ? " - Highest" : ""),
                  url: variants[j].url,
                  quality,
                  headers
                });
              }
            } else if (playlist.indexOf("#EXTM3U") >= 0) {
              output.push({ name: "TopCinema", title: "HLS", url, quality: "HLS", headers });
            }
          }
        } catch (error) {
          log("Could not inspect HLS playlist: " + error.message);
          output.push({ name: "TopCinema", title: "HLS", url, quality: "HLS", headers });
        }
      } else if (/\.mp4(?:\?|$)/i.test(url)) {
        output.push({
          name: "TopCinema",
          title: "MP4",
          url,
          quality: "MP4",
          headers: { "User-Agent": USER_AGENT, "Referer": embedUrl }
        });
      }
    }
    return output;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      if (mediaType !== "movie" && mediaType !== "tv") return [];
      if (mediaType === "tv" && (!season || !episode)) return [];
      const metadata = yield getMetadata(tmdbId, mediaType);
      if (!metadata.title) return [];
      const titles = [metadata.title];
      if (metadata.originalTitle && metadata.originalTitle !== metadata.title) titles.push(metadata.originalTitle);
      let contentUrl = "";
      for (let i = 0; i < titles.length && !contentUrl; i++) {
        contentUrl = yield searchTopCinema(titles[i], metadata.year);
      }
      if (!contentUrl) {
        log("No matching TopCinema result for " + metadata.title);
        return [];
      }
      let contentHtml = yield getText(contentUrl);
      let playerPage = contentUrl;
      if (mediaType === "tv") {
        let episodeUrl = findEpisodeLink(contentHtml, contentUrl, season, episode);
        if (!episodeUrl) {
          const watchUrl = contentUrl.replace(/\/$/, "") + "/watch/";
          try {
            const watchHtml = yield getText(watchUrl);
            episodeUrl = findEpisodeLink(watchHtml, watchUrl, season, episode);
          } catch (_) {
          }
        }
        if (!episodeUrl) {
          log("Episode link not found; refusing to return a generic series stream.");
          return [];
        }
        playerPage = episodeUrl;
        contentHtml = yield getText(playerPage);
      } else {
        playerPage = contentUrl.replace(/\/$/, "") + "/watch/";
        try {
          contentHtml = yield getText(playerPage);
        } catch (_) {
          playerPage = contentUrl;
          contentHtml = yield getText(contentUrl);
        }
      }
      const iframeUrl = getIframe(contentHtml, playerPage);
      if (!iframeUrl) {
        log("No player iframe found.");
        return [];
      }
      return yield streamsFromPlayer(iframeUrl);
    } catch (error) {
      log("Provider error: " + (error && error.message ? error.message : String(error)));
      return [];
    }
  });
}
module.exports = { getStreams };
