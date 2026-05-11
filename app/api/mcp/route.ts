import { createMcpHandler } from "@vercel/mcp-adapter";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const handler = createMcpHandler((server) => {
  server.tool(
    "generate_image",
    "Generate an image from a text prompt using OpenAI gpt-image-1",
    {
      prompt: z.string().describe("What image to generate (in English for best results)"),
      size: z
        .enum(["1024x1024", "1536x1024", "1024x1536"])
        .optional()
        .default("1024x1024")
        .describe("Image size: square, landscape, or portrait"),
      quality: z
        .enum(["low", "medium", "high"])
        .optional()
        .default("medium")
        .describe("Image quality (affects cost and generation time)"),
    },
    async ({ prompt, size, quality }) => {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: size as "1024x1024" | "1536x1024" | "1024x1536",
        quality: quality as "low" | "medium" | "high",
      });

      const base64 = response.data[0].b64_json!;

      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully!\n\nBase64 PNG (copy and decode to view):\ndata:image/png;base64,${base64}`,
          },
        ],
      };
    }
  );
});

function withAuth(req: Request, fn: (req: Request) => Promise<Response>) {
  const accessKey = req.headers.get("x-api-key");
  if (accessKey !== process.env.MCP_ACCESS_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return fn(req);
}

export const GET = (req: Request) => withAuth(req, handler);
export const POST = (req: Request) => withAuth(req, handler);
export const DELETE = (req: Request) => withAuth(req, handler);
