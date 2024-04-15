import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import type { DynamoDBBatchResponse, DynamoDBStreamHandler } from "aws-lambda";
import { ConnectionEntity } from "@/entities/connection";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { MessageEntity, type MessageEntityType } from "@/entities/message";

export const handler: DynamoDBStreamHandler = async (event) => {
  // トリガーされたメッセージをすべて取得。他のエンティティなら無視
  // 参考：ElectroDBへのパース方法: https://electrodb.dev/en/reference/parse/#dynamo-streams
  const messages = event.Records.filter((record) => record.dynamodb?.NewImage)
    .map((record) => {
      // NOTE: SDK v2におけるDynamoDB.Converter.unmarshallは、@aws-sdk/util-dynamodbに移行されている
      console.log("record.dynamodb!.NewImage", record.dynamodb!.NewImage!);
      return unmarshall(
        record.dynamodb!.NewImage! as Record<string, AttributeValue>
      );
    })
    .map((item) => {
      console.log("parsed item", item);
      if (item.__edb_e__ === "Message") {
        const { data: message } = MessageEntity.parse({ Item: item });
        return message;
      }
      return null;
    })
    .filter((item): item is MessageEntityType => item !== null);

  console.log("messages", messages);
  if (messages.length === 0) {
    return {
      batchItemFailures: [],
    };
  }

  // 現在WebSocket APIに接続しているIDをすべて取得
  const { data: connections } = await ConnectionEntity.query
    .connections({})
    .go({ pages: "all" });
  // WebSocket API
  const api = new ApiGatewayManagementApi({
    endpoint: process.env.WS_API_URL,
  });
  // すべての接続者にメッセージを送信
  // NOTE: 仮にルーム機能を実装して、ルームごとの接続者にメッセージを送信するなら、ConnectionEntityにルームIDを追加するなどのアプローチが考えられる
  const postCalls = connections.map(async ({ connectionId }) => {
    console.log(`Sending message to ${connectionId}`);
    return await api.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(messages),
    });
  });
  const result = await Promise.all(postCalls);

  // https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html#services-ddb-batchfailurereporting
  // https://stackoverflow.com/questions/67680152/how-can-i-prevent-dynamodb-stream-handler-from-infinitely-processing-a-record-wh
  const response: DynamoDBBatchResponse = {
    batchItemFailures: result
      .filter((r) => r.$metadata.httpStatusCode !== 200)
      .map((r) => ({ itemIdentifier: r.$metadata.requestId! })),
  };
  return response;
};
