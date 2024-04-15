export * as Dynamo from "./dynamo";

import { type EntityConfiguration } from "electrodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Resource } from "sst";

export const Client = new DynamoDBClient({});

export const Configuration: EntityConfiguration = {
  table: Resource.DscTable.name,
  client: Client,
};
