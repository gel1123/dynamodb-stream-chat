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
      /** メッセージID */
      messageId: {
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
    },
    indexes: {
      orderByCreatedAt: {
        pk: {
          field: "pk",
          composite: [],
        },
        sk: {
          field: "sk",
          composite: ["createdAt", "messageId"],
        },
      },
    },
  },
  Dynamo.Configuration
);

export type MessageEntityType = EntityItem<typeof MessageEntity>;
