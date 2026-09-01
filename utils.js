export function parseYouTubeDuration(duration) {
  const match = duration?.match(
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
  );

  if (!match) {
    return {
      iso: duration,
      seconds: 0,
      formatted: "0:00"
    };
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);

  const totalSeconds =
    hours * 3600 +
    minutes * 60 +
    seconds;

  const formatted =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return {
    iso: duration,
    seconds: totalSeconds,
    formatted
  };
}

export function extractYouTubeVideoId(input) {
  const value = input.trim();

  // ID directo
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);

    // youtube.com/watch?v=...
    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      const videoId = url.searchParams.get("v");

      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }

      // youtube.com/shorts/...
      const shortsMatch = url.pathname.match(
        /^\/shorts\/([a-zA-Z0-9_-]{11})/
      );

      if (shortsMatch) {
        return shortsMatch[1];
      }

      // youtube.com/embed/...
      const embedMatch = url.pathname.match(
        /^\/embed\/([a-zA-Z0-9_-]{11})/
      );

      if (embedMatch) {
        return embedMatch[1];
      }
    }

    // youtu.be/...
    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.slice(1).split("/")[0];

      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveYouTubeChannel(yt, input) {
  const value = input.trim();

  // Channel ID directo
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(value)) {
    return value;
  }

  // @handle
  if (value.startsWith("@")) {
    const response = await yt.channels.list({
      part: ["id"],
      forHandle: value
    });

    return response.data.items?.[0]?.id ?? null;
  }

  try {
    const url = new URL(value);

    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      // /channel/UC...
      const channelMatch = url.pathname.match(
        /^\/channel\/(UC[a-zA-Z0-9_-]{22})/
      );

      if (channelMatch) {
        return channelMatch[1];
      }

      // /@handle
      const handleMatch = url.pathname.match(
        /^\/(@[^/]+)/
      );

      if (handleMatch) {
        const response = await yt.channels.list({
          part: ["id"],
          forHandle: handleMatch[1]
        });

        return response.data.items?.[0]?.id ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}