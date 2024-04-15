/// <reference path="./.sst/platform/config.d.ts" />
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export default $config({
  app(input) {
    return {
      name: "dynamodb-stream-chat",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // DynamoDB ----------------------------------------------------------
    const table = new sst.aws.Dynamo("DscTable", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
        gsi2pk: "string",
        gsi2sk: "string",
        gsi3pk: "string",
        gsi3sk: "string",
        gsi4pk: "string",
        gsi4sk: "string",
        gsi5pk: "string",
        gsi5sk: "string",
        lsi1: "string",
        lsi2: "string",
        lsi3: "string",
        lsi4: "string",
        lsi5: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
        gsi2: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
        gsi3: { hashKey: "gsi3pk", rangeKey: "gsi3sk" },
        gsi4: { hashKey: "gsi4pk", rangeKey: "gsi4sk" },
        gsi5: { hashKey: "gsi5pk", rangeKey: "gsi5sk" },
      },
      localIndexes: {
        lsi1: { rangeKey: "lsi1" },
        lsi2: { rangeKey: "lsi2" },
        lsi3: { rangeKey: "lsi3" },
        lsi4: { rangeKey: "lsi4" },
        lsi5: { rangeKey: "lsi5" },
      },
      transform: {
        table: {
          ttl: {
            attributeName: "ttl",
            enabled: true,
          },
        },
      },
      stream: "new-image",
    });

    // Chat Handler ------------------------------------------------------
    const chatHandler = new sst.aws.Function("DscChatHandler", {
      handler: "src/api/chat.handler",
      link: [table],
    });

    // API ---------------------------------------------------------------
    // SST IonはまだWebSocket APIをサポートしていないため、Pulumiで作成
    const wsApi = new aws.apigatewayv2.Api("DscWsApi", {
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.action",
    });
    // WebSocket API へのルートと統合の設定
    // 接続ルート
    const connectIntegration = new aws.apigatewayv2.Integration(
      "DscConnectIntegration",
      {
        apiId: wsApi.id,
        integrationType: "AWS_PROXY",
        integrationUri: chatHandler.arn,
        integrationMethod: "POST",
        payloadFormatVersion: "1.0",
      }
    );
    const connectRoute = new aws.apigatewayv2.Route("DscConnectRoute", {
      apiId: wsApi.id,
      routeKey: "$connect",
      authorizationType: "NONE",
      target: pulumi.interpolate`integrations/${connectIntegration.id}`,
    });
    // 切断ルート
    const disconnectIntegration = new aws.apigatewayv2.Integration(
      "DscDisconnectIntegration",
      {
        apiId: wsApi.id,
        integrationType: "AWS_PROXY",
        integrationUri: chatHandler.arn,
        integrationMethod: "POST",
        payloadFormatVersion: "1.0",
      }
    );
    const disconnectRoute = new aws.apigatewayv2.Route("DscDisconnectRoute", {
      apiId: wsApi.id,
      routeKey: "$disconnect",
      authorizationType: "NONE",
      target: pulumi.interpolate`integrations/${disconnectIntegration.id}`,
    });

    // DynamoDB Streams --------------------------------------------------
    const subscriber = table.subscribe({
      handler: "src/api/trigger.handler",
      link: [table],
      environment: {
        WS_API_URL: wsApi.apiEndpoint,
      },
    });

    // Astro -------------------------------------------------------------
    new sst.aws.Astro("DscAstro", {
      link: [table],
      environment: {
        PUBLIC_WS_API_URL: wsApi.apiEndpoint,
      },
    });
  },
});
