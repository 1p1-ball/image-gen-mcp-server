import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { z } from "zod";

export const config = { api: { bodyParser: false } };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function createServer() {
  const server = new McpServer({ name: "image-gen-mcp", version: "1.0.0" });

  server.tool(
    "generate_image",
    "Generate an image from a text prompt using OpenAI gpt-image-1",
    {
      prompt: z.string().describe("What image to generate"),
      size: z
        .enum(["1024x1024", "1536x1024", "1024x1536"])
        .optional()
        .default("1024x1024"),
      quality: z
        .enum(["low", "medium", "high"])
        .optional()
        .default("medium"),
    },
    async ({ prompt, size, quality }) => {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: size as "1024x1024" | "1536x1024" | "1024x1536",
        quality: quality as "low" | "medium" | "high",
      });

      const base64 = response.data?.[0]?.b64_json ?? "";

      return {
        content: [{ type: "text", text: `data:image/png;base64,${base64}` }],
      };
    }
  );

  return server;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers["x-api-key"] !== process.env.MCP_ACCESS_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res);
  await server.close();
}
