import { Dynamo } from "@/dynamo";
import { Entity, type EntityItem } from "electrodb";

export const ConnectionEntity = new Entity(
  {
    model: {
      version: "1",
      entity: "Connection",
      service: "dsc",
    },
    attributes: {
      /** 接続ID */
      connectionId: {
        type: "string",
        required: true,
        readOnly: true,
      },
      /** 作成日時 */
      createdAt: {
        type: "number",
        required: true,
        readOnly: true,
      },
      /** DynamoDBのTTL */
      ttl: {
        type: "number",
        required: false,
        readOnly: false,
      },
    },
    indexes: {
      byConnectionId: {
        collection: ["connection"],
        pk: {
          field: "pk",
          composite: ["connectionId"],
        },
        sk: {
          field: "sk",
          composite: [],
        },
      },
      orderByCreatedAt: {
        index: "gsi1",
        pk: {
          field: "gsi1pk",
          composite: [],
        },
        sk: {
          field: "gsi1sk",
          composite: ["createdAt"],
        },
      },
    },
  },
  Dynamo.Configuration
);

export type ConnectionEntityType = EntityItem<typeof ConnectionEntity>;
