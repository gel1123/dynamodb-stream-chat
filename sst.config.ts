/// <reference path="./.sst/platform/config.d.ts" />
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// 参考: https://dev.classmethod.jp/articles/cdk-api-gateway-web-socket/

export default $config({
  app(input) {
    return {
      name: "dynamodb-stream-chat",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    // https://ion.sst.dev/docs/providers/#functions
    const current = await aws.getCallerIdentity({});
    const accountId = current.accountId;
    const region = (await aws.getRegion({})).name;

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
    // デフォルトルート
    const defaultIntegration = new aws.apigatewayv2.Integration(
      "DscDefaultIntegration",
      {
        apiId: wsApi.id,
        integrationType: "AWS_PROXY",
        integrationUri: chatHandler.arn,
        integrationMethod: "POST",
        payloadFormatVersion: "1.0",
      }
    );
    const defaultRoute = new aws.apigatewayv2.Route("DscDefaultRoute", {
      apiId: wsApi.id,
      routeKey: "$default",
      authorizationType: "NONE",
      target: pulumi.interpolate`integrations/${defaultIntegration.id}`,
    });
    // ステージの指定
    const stage = new aws.apigatewayv2.Stage("DscWsApiStage", {
      apiId: wsApi.id,
      name: $app.stage,
      autoDeploy: true,
    });
    // chatHandlerをコールできる権限
    // 参考: https://www.pulumi.com/ai/answers/6hiobuc3otmKxAJcGzkZ6E/lambda-and-api-gateway-integration-in-aws
    const chatInvokePermission = new aws.lambda.Permission(
      "DscChatInvokePermission",
      {
        action: "lambda:InvokeFunction",
        function: chatHandler.arn,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${wsApi.executionArn}/*/*`,
      }
    );

    // DynamoDB Streams --------------------------------------------------
    // execute-api:ManageConnectionsの許可が必要
    // MEMO: filter定義も可能 https://ion.sst.dev/docs/component/aws/dynamo/
    const subscriber = table.subscribe({
      handler: "src/api/trigger.handler",
      link: [table],
      environment: {
        WS_API_URL: wsApi.apiEndpoint,
        STAGE: $app.stage,
      },
      permissions: [
        // {
        //   actions: ["execute-api:ManageConnections"],
        //   resources: [
        //     pulumi.interpolate`arn:aws:execute-api:${region}:${accountId}:${wsApi.id}/${$app.stage}/POST/@connections/*`,
        //   ],
        // },
        {
          actions: ["*"],
          resources: ["*"],
        },
      ],
    });

    // Astro -------------------------------------------------------------
    new sst.aws.Astro("DscAstro", {
      link: [table],
      environment: {
        WS_API_URL: wsApi.apiEndpoint,
        STAGE: $app.stage,
      },
    });
  },
});
