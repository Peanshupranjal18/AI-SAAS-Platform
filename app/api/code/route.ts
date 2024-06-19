// Import necessary modules and functions from external libraries
import { auth } from "@clerk/nextjs"; // Clerk library for user authentication
import { NextResponse } from "next/server"; // Next.js library for server responses
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai"; // OpenAI library for API integration

// Import custom functions for subscription and API limit checks
import { checkSubscription } from "@/lib/subscription";
import { incrementApiLimit, checkApiLimit } from "@/lib/api-limit";

// Configuration object for OpenAI API with organization and API key
const configuration = new Configuration({
  organization: 'org-JoUv0zg74Z5d6EbzP0pvzy8U', // OpenAI organization ID
  apiKey: process.env.OPENAI_API_KEY, // OpenAI API key from environment variables
});

// Create an instance of OpenAIApi with the given configuration
const openai = new OpenAIApi(configuration);

// System instruction message for the OpenAI chat model
const instructionMessage: ChatCompletionRequestMessage = {
  role: "system",
  content: "You are a code generator. You must answer only in markdown code snippets. Use code comments for explanations."
};

// Export an async function to handle POST requests
export async function POST(
  req: Request // Request object
) {
  try {
    const { userId } = auth(); // Get the authenticated user ID
    const body = await req.json(); // Parse the request body as JSON
    const { messages } = body; // Extract the messages from the request body

    // Check if user is authenticated
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 }); // Return 401 if not authenticated
    }

    // Check if OpenAI API key is configured
    if (!configuration.apiKey) {
      return new NextResponse("OpenAI API Key not configured.", { status: 500 }); // Return 500 if API key is missing
    }

    // Check if messages are provided in the request
    if (!messages) {
      return new NextResponse("Messages are required", { status: 400 }); // Return 400 if messages are missing
    }

    // Check if the user has exceeded the free trial API limit
    const freeTrial = await checkApiLimit();
    // Check if the user has a subscription
    const isPro = await checkSubscription();

    // If the user has neither free trial access nor a subscription
    if (!freeTrial && !isPro) {
      return new NextResponse("Free trial has expired. Please upgrade to pro.", { status: 403 }); // Return 403 if no access
    }

    // Create a chat completion request to OpenAI with the system message and user messages
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo", // Specify the model to use
      messages: [instructionMessage, ...messages] // Include system message followed by user messages
    });

    // If the user is not a pro subscriber, increment their API usage limit
    if (!isPro) {
      await incrementApiLimit();
    }

    // Return the response from OpenAI as JSON
    return NextResponse.json(response.data.choices[0].message);
  } catch (error) {
    // Log the error and return a 500 Internal Server Error response
    console.log('[CODE_ERROR]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
};
