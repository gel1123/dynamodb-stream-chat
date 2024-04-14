import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log("Event: ", event);

  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;
  const body = event.body;

  // TODO: not implemented yet
  switch (routeKey) {
    case "$connect":
      console.log(`[${connectionId}] Connected.`);
      break;
    case "$disconnect":
      console.log(`[${connectionId}] Disconnected.`);
      break;
    case "$message":
      console.log(`[${connectionId}] Message: ${body}`);
      break;
  }
  return { statusCode: 200, body: "Data sent." };
};
