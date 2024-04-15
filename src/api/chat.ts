import { ConnectionEntity } from "@/entities/connection";
import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log("ChatHandler Event: ", event);

  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;

  switch (routeKey) {
    case "$connect":
      await ConnectionEntity.create({ connectionId }).go();
      console.log(`[${connectionId}] Connected.`);
      return {
        statusCode: 200,
        body: "Connected",
      };
    case "$disconnect":
      await ConnectionEntity.delete({ connectionId }).go();
      console.log(`[${connectionId}] Disconnected.`);
      return {
        statusCode: 200,
        body: "Disconnected",
      };
  }
  return { statusCode: 200, body: "Data sent." };
};
