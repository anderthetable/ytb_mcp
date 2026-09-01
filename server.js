import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { youtube } from "@googleapis/youtube";
import { z } from "zod";
import "dotenv/config";
import { parseYouTubeDuration, extractYouTubeVideoId } from "./utils.js";

const PORT = process.env.PORT || 3000;

const yt = youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY
});

const app = express();

app.use(express.json());

function createMcpServer() {
  const server = new McpServer({
    name: "youtube-search",
    version: "1.0.0"
  });

  server.registerTool(
    "search_youtube_videos",
    {
      title: "Search YouTube Videos",
      description:
        "Search YouTube videos and return metadata including title, channel, date, duration, views, likes and comments.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Search query for YouTube"),

        maxResults: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum number of videos to return"),

        order: z
          .enum(["relevance", "date", "viewCount", "rating"])
          .default("relevance")
          .describe("Order of search results"),

        publishedAfter: z
          .string()
          .datetime()
          .optional()
          .describe("Only return videos published after this ISO 8601 date"),

        publishedBefore: z
          .string()
          .datetime()
          .optional()
          .describe("Only return videos published before this ISO 8601 date"),

        videoDuration: z
          .enum(["any", "short", "medium", "long"])
          .default("any")
          .describe("Filter videos by duration"),

        regionCode: z
          .string()
          .length(2)
          .optional()
          .describe("Two-letter country code, for example ES or US"),

        language: z
          .string()
          .optional()
          .describe("Language preference, for example es or en")

      }
    },
    async ({ 
      query, 
      maxResults,
      order,
      publishedAfter,
      publishedBefore,
      videoDuration,
      regionCode,
      language 
    }) => {
      const searchResponse = await yt.search.list({
        part: ["snippet"],
        q: query,
        type: ["video"],
        maxResults,
        order,
        publishedAfter,
        publishedBefore,
        videoDuration,
        regionCode,
        relevanceLanguage: language
      });

      const videoIds = searchResponse.data.items
        ?.map(item => item.id?.videoId)
        .filter(Boolean);

      if (!videoIds?.length) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query,
                videos: []
              })
            }
          ]
        };
      }

      const videosResponse = await yt.videos.list({
        part: ["snippet", "statistics", "contentDetails"],
        id: videoIds
      });

      const videos = videosResponse.data.items?.map(video => ({
        id: video.id,
        title: video.snippet?.title,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        channel: video.snippet?.channelTitle,
        channelId: video.snippet?.channelId,
        publishedAt: video.snippet?.publishedAt,
        description: video.snippet?.description,
        thumbnail: video.snippet?.thumbnails?.high?.url
          ?? video.snippet?.thumbnails?.default?.url,
        tags: video.snippet?.tags ?? [],
        duration: parseYouTubeDuration(video.contentDetails?.duration),
        statistics: {
          views: Number(video.statistics?.viewCount ?? 0),
          likes: Number(video.statistics?.likeCount ?? 0),
          comments: Number(video.statistics?.commentCount ?? 0)
        }
      })) ?? [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query,
              count: videos.length,
              videos
            })
          }
        ]
      };
    }
  );

  server.registerTool(
  "get_youtube_video",
  {
    title: "Get YouTube Video",
    description:
      "Get detailed metadata and statistics for a specific YouTube video.",
    inputSchema: {
      video: z
        .string()
        .min(1)
        .describe("YouTube video ID or URL. Supports youtube.com/watch, youtu.be, youtube.com/shorts and youtube.com/embed URLs.")
    }
  },
  async ({ video }) => {
    const videoId = extractYouTubeVideoId(video);

    if (!videoId) {
      return {
        content: [
          {
            type: "text",
              text: JSON.stringify({
              error: "Invalid YouTube video ID or URL",
              input: video
            })
          }
        ]
      };
    }

    const response = await yt.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: [videoId]
    });

    const videoData = response.data.items?.[0];

    if (!videoData) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Video not found",
              videoId
            })
          }
        ]
      };
    }

    const duration = parseYouTubeDuration(
      videoData.contentDetails?.duration
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: videoData.id,
            title: videoData.snippet?.title,
            url: `https://www.youtube.com/watch?v=${videoData.id}`,
            channel: videoData.snippet?.channelTitle,
            channelId: videoData.snippet?.channelId,
            publishedAt: videoData.snippet?.publishedAt,
            description: videoData.snippet?.description,
            tags: videoData.snippet?.tags ?? [],
            thumbnail:
              videoData.snippet?.thumbnails?.high?.url ??
              videoData.snippet?.thumbnails?.default?.url,
            duration,
            statistics: {
              views: Number(
                videoData.statistics?.viewCount ?? 0
              ),
              likes: Number(
                videoData.statistics?.likeCount ?? 0
              ),
              comments: Number(
                videoData.statistics?.commentCount ?? 0
              )
            }
          })
        }
      ]
    };
  }
);

  return server;
}

app.post("/mcp", async (req, res) => {
  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);

  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "youtube-mcp"
  });
});

app.listen(PORT, () => {
  console.log(`YouTube MCP listening on port ${PORT}`);
});