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