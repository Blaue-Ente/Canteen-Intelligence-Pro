import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

interface ChatBody {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
}

router.post("/ai/chat", async (req: Request, res: Response) => {
  const body = req.body as ChatBody;
  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: body.messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "ai chat error");
    res.write(
      `data: ${JSON.stringify({
        content:
          "\n[KI-Fehler: " +
          (err instanceof Error ? err.message : "unknown") +
          "]",
      })}\n\n`,
    );
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

interface VisionBody {
  base64: string;
  prompt: string;
}

router.post("/ai/vision", async (req: Request, res: Response) => {
  const body = req.body as VisionBody;
  if (!body?.base64 || !body?.prompt) {
    res.status(400).json({ error: "base64 and prompt required" });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: body.prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${body.base64}` },
            },
          ],
        },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    res.json({ text });
  } catch (err) {
    req.log.error({ err }, "ai vision error");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
