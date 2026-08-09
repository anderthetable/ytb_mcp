import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { youtube } from "@googleapis/youtube";
import { z } from "zod";
import "dotenv/config";

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
          .describe("Maximum number of videos to return")
      }
    },
    async ({ query, maxResults }) => {
      const searchResponse = await yt.search.list({
        part: ["snippet"],
        q: query,
        type: ["video"],
        maxResults
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
        channel: video.snippet?.channelTitle,
        channelId: video.snippet?.channelId,
        publishedAt: video.snippet?.publishedAt,
        description: video.snippet?.description,
        tags: video.snippet?.tags ?? [],
        duration: video.contentDetails?.duration,
        views: Number(video.statistics?.viewCount ?? 0),
        likes: Number(video.statistics?.likeCount ?? 0),
        comments: Number(video.statistics?.commentCount ?? 0)
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