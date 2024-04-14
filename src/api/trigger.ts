import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import type { DynamoDBBatchResponse, DynamoDBStreamHandler } from "aws-lambda";
import {
  ConnectionEntity,
  type ConnectionEntityType,
} from "@/entities/connection";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";

export const handler: DynamoDBStreamHandler = async (event) => {
  // トリガーされた接続情報をすべて取得。他のエンティティなら無視
  // 参考：ElectroDBへのパース方法: https://electrodb.dev/en/reference/parse/#dynamo-streams
  const connections = event.Records.map((record) =>
    // NOTE: SDK v2におけるDynamoDB.Converter.unmarshallは、@aws-sdk/util-dynamodbに移行されている
    unmarshall(record.dynamodb!.NewImage! as Record<string, AttributeValue>)
  )
    .map((item) => {
      if (item._k !== undefined || item._k !== null) {
        const { data: connection } = ConnectionEntity.parse({ Item: item });
        return connection;
      }
      return null;
    })
    .filter((item): item is ConnectionEntityType => item !== null);

  // WebSocket API
  const api = new ApiGatewayManagementApi({
    endpoint: process.env.WS_API_URL,
  });
  const postCalls = connections.map(async ({ connectionId }) => {
    console.log(`Sending message to ${connectionId}`);
    return await api.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(event),
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
