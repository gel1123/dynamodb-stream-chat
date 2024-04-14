import { Configuration } from "@/dynamo";
import {
  ConnectionEntity,
  type ConnectionEntityType,
} from "@/entities/connection";
import { MessageEntity, type MessageEntityType } from "@/entities/message";
import {
  ParticipantEntity,
  type ParticipantEntityType,
} from "@/entities/participant";
import { Service } from "electrodb";
import { v4 } from "uuid";

export class ConnectionService {
  private readonly electroDbApp = new Service(
    {
      connectionEntity: ConnectionEntity,
      messageEntity: MessageEntity,
      participantEntity: ParticipantEntity,
    },
    Configuration
  );

  /** 特定の人物が接続を開始する */
  async startConnection({ participantName }: { participantName: string }) {
    const connection: ConnectionEntityType = {
      connectionId: v4(),
      createdAt: Date.now(),
      // DynamoDBのTTLで、万が一ゴミデータが残っても自動で削除されるようにする。1日後に削除されるように設定
      ttl: this.calculateTTL(),
    };
    const participant: ParticipantEntityType = {
      connectionId: connection.connectionId,
      participantId: v4(),
      name: participantName,
      ttl: connection.ttl,
    };

    await this.electroDbApp.transaction
      .write(({ connectionEntity, participantEntity }) => {
        return [
          connectionEntity.create(connection).commit(),
          participantEntity.create(participant).commit(),
        ];
      })
      .go();

    return { connection, participant };
  }

  /** 接続終了 */
  async endConnection(connectionId: string) {
    await ConnectionEntity.delete({
      connectionId,
    }).go();
  }

  /** 接続に関するすべての情報取得 */
  async getConnection(connectionId: string) {
    const { data } = await this.electroDbApp.collections
      .connection({
        connectionId,
      })
      .go({ pages: "all" });
    const connection = data.connectionEntity[0];
    return {
      connection,
      message: data.messageEntity,
      participant: data.participantEntity,
    };
  }

  /** メッセージの書き込み */
  async writeMessage({
    connectionId,
    participantId,
    body,
  }: {
    connectionId: string;
    participantId: string;
    body: string;
  }) {
    const { data: connection } = await ConnectionEntity.get({
      connectionId,
    }).go({
      attributes: ["ttl"],
    });
    if (!connection) {
      throw new Error("Connection not found");
    }
    const message: MessageEntityType = {
      connectionId,
      participantId,
      messageId: v4(),
      createdAt: Date.now(),
      body,
      ttl: connection.ttl,
    };
    await MessageEntity.create(message).go();
    return message;
  }

  /** 参加者の追加 */
  async addParticipant({
    connectionId,
    participantName,
  }: {
    connectionId: string;
    participantName: string;
  }) {
    const { data: connection } = await ConnectionEntity.get({
      connectionId,
    }).go({
      attributes: ["ttl"],
    });
    if (!connection) {
      throw new Error("Connection not found");
    }
    const participant: ParticipantEntityType = {
      connectionId,
      participantId: v4(),
      name: participantName,
      ttl: connection.ttl,
    };
    await ParticipantEntity.create(participant).go();
    return participant;
  }

  /** 接続に関するDynamoDBのTTLを算出（1日で自動削除） */
  private calculateTTL() {
    return Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  }
}
