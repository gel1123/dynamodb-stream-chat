import { ConnectionEntity } from "@/entities/connection";
import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;

  // $connectならクエリパラメータから値を取得できる（TSの型定義が存在しないが、実際には存在する）
  // 逆に、$disconnectはクエリパラメータから値を取得できず、undefinedになる
  // MEMO: 処理をカスタマイズしたいなら、クエリパラメータを利用するのも一つの方法
  const flag = (event as any).queryStringParameters?.f;
  console.log("------------------- flag -------------------\n", flag);

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
    case "$default":
      console.log(`[${connectionId}] Invalid route.`);
      return {
        statusCode: 400,
        body: "Invalid route",
      };
  }
  return { statusCode: 200, body: "Data sent." };
};
