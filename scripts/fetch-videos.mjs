// Récupère les dernières vidéos des chaînes de data/channels.json via les flux RSS publics de YouTube.
// Usage : node scripts/fetch-videos.mjs   (aucune dépendance)
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

export function parseFeed(xml, channelName, limit = 12) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = e.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const published = e.match(/<published>([^<]+)<\/published>/)?.[1];
    if (id && title) out.push({ id, title: decode(title.trim()), channel: channelName, published: published ?? '' });
  }
  return out.sort((a, b) => b.published.localeCompare(a.published)).slice(0, limit);
}

async function main() {
  const channels = JSON.parse(await readFile('data/channels.json', 'utf8'));
  const videos = [];
  for (const c of channels) {
    if (!/^UC[\w-]{22}$/.test(c.channelId ?? '')) { console.warn(`Ignoré (channelId invalide) : ${c.name}`); continue; }
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.channelId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      videos.push(...parseFeed(await res.text(), c.name));
    } catch (err) { console.warn(`Échec pour ${c.name} : ${err.message}`); }
  }
  await writeFile('data/videos.json', `${JSON.stringify({ updated: new Date().toISOString(), videos }, null, 2)}\n`);
  console.log(`${videos.length} vidéos écrites.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
