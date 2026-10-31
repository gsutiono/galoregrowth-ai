# Episode 2 fixes

- Homepage "Watch in Podcast Library" now links to `#podcastLibrary` on the same page.
- The latest-episode script no longer overwrites that link with a `/podcast/episode-2` path.
- Episode 2 duration in the source is unknown (`null`). The podcast library now attempts to calculate the actual length from Cloudflare Stream HLS playlist when cross-origin access permits. If Cloudflare denies cross-origin playlist access, the duration cannot be determined without retrieving it in your Cloudflare dashboard and manually entering it in `public/podcast/episodes.json`. No fake length has been added.
- All prior mobile recovery fixes retained.
