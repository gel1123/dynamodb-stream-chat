import { Dynamo } from "@/dynamo";
import { Entity, type EntityItem } from "electrodb";

export const MessageEntity = new Entity(
  {
    model: {
      version: "1",
      entity: "Message",
      service: "dsc",
    },
    attributes: {
      /** 接続ID */
      connectionId: {
        type: "string",
        required: true,
        readOnly: true,
      },
      /** コレクション問い合わせ時の並び順制御キー。メッセージエンティティは固定で10 */
      _k: {
        type: "string",
        required: true,
        readOnly: true,
        // https://electrodb.dev/en/modeling/attributes/#hidden
        hidden: true,
        default: "10",
      },
      /** メッセージID */
      messageId: {
        type: "string",
        required: true,
        readOnly: true,
      },
      /** 参加者ID */
      participantId: {
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
      /** メッセージ本文 */
      body: {
        type: "string",
        required: true,
        readOnly: false,
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
          composite: ["_k", "createdAt", "messageId"],
        },
      },
    },
  },
  Dynamo.Configuration
);

export type MessageEntityType = EntityItem<typeof MessageEntity>;
