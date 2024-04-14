import { Dynamo } from "@/dynamo";
import { Entity, type EntityItem } from "electrodb";

/** チャットの参加者。接続ごとに作成される */
export const ParticipantEntity = new Entity(
  {
    model: {
      version: "1",
      entity: "Participant",
      service: "dsc",
    },
    attributes: {
      /** 接続ID */
      connectionId: {
        type: "string",
        required: true,
        readOnly: true,
      },
      /** コレクション問い合わせ時の並び順制御キー。参加者エンティティでは固定で00 */
      _k: {
        type: "string",
        required: true,
        readOnly: true,
        // https://electrodb.dev/en/modeling/attributes/#hidden
        hidden: true,
        default: "00",
      },
      /** 参加者ID */
      participantId: {
        type: "string",
        required: true,
        readOnly: true,
      },
      /** 参加者名 */
      name: {
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
      byParticipantId: {
        collection: ["connection"],
        pk: {
          field: "pk",
          composite: ["connectionId"],
        },
        sk: {
          field: "sk",
          composite: ["_k", "name", "participantId"],
        },
      },
    },
  },
  Dynamo.Configuration
);

export type ParticipantEntityType = EntityItem<typeof ParticipantEntity>;
