import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      race = "",
      horse = "",
      type = "Win",
      confidence = "High",
      note = "",
      tipperNotes = "",
    } = body ?? {};

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const prompt = `
You are the lead tipster for SmartPunt, a premium Australian horse racing tipping service.

Write sharp, confident, professional betting commentary.

STYLE RULES:
- Australian punter tone
- Confident but not arrogant
- No fluff, no generic AI wording
- Sound like a paid tipping service
- Short, punchy sentences
- Focus on WHY the horse wins
- No made-up facts

DETAILS:
Race: ${race}
Horse: ${horse}
Bet type: ${type}
Confidence: ${confidence}
Tag: ${note}
Tipper notes: ${tipperNotes}

OUTPUT:
- 60 to 110 words
- One paragraph
- Clean, premium tone
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content:
              "You write sharp Australian horse racing tip commentary for SmartPunt, a premium tipping app.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "OpenAI request failed while generating commentary.",
        },
        { status: 500 },
      );
    }

    const commentary =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Unable to generate commentary right now.";

    return NextResponse.json({ commentary });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error generating commentary.",
      },
      { status: 500 },
    );
  }
}
