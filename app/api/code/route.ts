import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { checkSubscription } from "@/lib/subscription";
import { incrementApiLimit, checkApiLimit } from "@/lib/api-limit";

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const instructionMessage = "You are a code generator. You must answer only in markdown code snippets. Use code comments for explanations.";

export async function POST(
  req: Request
) {
  try {
    const { userId } = auth();
    const body = await req.json();
    const { messages } = body;

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!process.env.GOOGLE_API_KEY) {
      return new NextResponse("Google API Key not configured.", { status: 500 });
    }

    if (!messages) {
      return new NextResponse("Messages are required", { status: 400 });
    }

    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!freeTrial && !isPro) {
      return new NextResponse("Free trial has expired. Please upgrade to pro.", { status: 403 });
    }

    // Format messages for Gemini API
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Prepend the instruction message
    formattedMessages.unshift({
      role: 'model',
      parts: [{ text: instructionMessage }]
    });

    // Create a chat model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Start the chat
    const chat = model.startChat({
      history: formattedMessages,
    });

    // Generate a response
    const result = await chat.sendMessage("");

    const response = result.response;

    if (!isPro) {
      await incrementApiLimit();
    }

    return NextResponse.json({ role: "assistant", content: response.text() });
  } catch (error) {
    console.log('[CODE_ERROR]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
};