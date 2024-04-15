import { MessageEntity, type MessageEntityType } from "@/entities/message";
import type { APIRoute } from "astro";
import { v4 } from "uuid";

export const POST: APIRoute = async (args) => {
  try {
    const json = await args.request.json();
    const messageBody = json.messageBody;
    if (!messageBody) {
      return new Response(
        JSON.stringify({
          error: "messageBody is required",
        }),
        { status: 400 }
      );
    }
    const message: MessageEntityType = {
      messageId: v4(),
      body: messageBody,
      createdAt: Date.now(),
    };
    await MessageEntity.create(message).go();
    return new Response(
      JSON.stringify({
        message,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
      }),
      { status: 500 }
    );
  }
};
