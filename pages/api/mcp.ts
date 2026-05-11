import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import sharp from "sharp";
import { z } from "zod";

export const config = { api: { bodyParser: false } };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function createServer() {
  const server = new McpServer({ name: "image-gen-mcp", version: "1.0.0" });

  server.tool(
    "generate_image",
    `Generate an image and return it as a base64-encoded JPEG.
The result starts with FILE_BASE64: followed by the base64 string.
Save it with: echo "<base64>" | base64 -d > output.jpg`,
    {
      prompt: z.string().describe("What image to generate"),
      filename: z.string().optional().describe("Output filename e.g. cat.jpg"),
      size: z
        .enum(["1024x1024", "1536x1024", "1024x1536"])
        .optional()
        .default("1024x1024"),
      quality: z
        .enum(["low", "medium", "high"])
        .optional()
        .default("medium"),
    },
    async ({ prompt, filename, size, quality }) => {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: size as "1024x1024" | "1536x1024" | "1024x1536",
        quality: quality as "low" | "medium" | "high",
      });

      const rawBase64 = response.data?.[0]?.b64_json ?? "";
      const rawBuffer = Buffer.from(rawBase64, "base64");

      // Compress to JPEG max 1024px — ลดจาก ~2.5MB เหลือ ~100-200KB
      const compressed = await sharp(rawBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const compressedBase64 = compressed.toString("base64");
      const fname = filename ?? `image_${Date.now()}.jpg`;

      return {
        content: [
          {
            type: "text",
            text: `FILE_BASE64:${fname}:${compressedBase64}`,
          },
        ],
      };
    }
  );

  return server;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res);
  await server.close();
}
