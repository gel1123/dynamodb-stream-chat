import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import type { DynamoDBBatchResponse, DynamoDBStreamHandler } from "aws-lambda";
import {
  ConnectionEntity,
  type ConnectionEntityType,
} from "@/entities/connection";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { MessageEntity, type MessageEntityType } from "@/entities/message";

export const handler: DynamoDBStreamHandler = async (event) => {
  // トリガーされた接続情報をすべて取得。他のエンティティなら無視
  // 参考：ElectroDBへのパース方法: https://electrodb.dev/en/reference/parse/#dynamo-streams
  const messages = event.Records.map((record) =>
    // NOTE: SDK v2におけるDynamoDB.Converter.unmarshallは、@aws-sdk/util-dynamodbに移行されている
    unmarshall(record.dynamodb!.NewImage! as Record<string, AttributeValue>)
  )
    .map((item) => {
      if (item._k === "01") {
        const { data: message } = MessageEntity.parse({ Item: item });
        return message;
      }
      return null;
    })
    .filter((item): item is MessageEntityType => item !== null);

  // WebSocket API
  const api = new ApiGatewayManagementApi({
    endpoint: process.env.WS_API_URL,
  });
  const postCalls = messages.map(async (message) => {
    console.log(`Sending message to ${message.connectionId}`);
    return await api.postToConnection({
      ConnectionId: message.connectionId,
      Data: JSON.stringify(message),
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
