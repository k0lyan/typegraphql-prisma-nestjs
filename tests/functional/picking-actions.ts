import "reflect-metadata";
import { promises as fs } from "fs";
import { printSchema } from "graphql";
import { buildNestSchema, resetForNewSchema } from "../helpers/build-schema";

import generateArtifactsDirPath from "../helpers/artifacts-dir";
import { generateCodeFromSchema } from "../helpers/generate-code";

describe("picking prisma actions", () => {
  let outputDirPath: string;

  beforeEach(async () => {
    resetForNewSchema();
    outputDirPath = generateArtifactsDirPath("functional-picking-actions");
    await fs.mkdir(outputDirPath, { recursive: true });
    const prismaSchema = /* prisma */ `
      model User {
        intIdField          Int     @id @default(autoincrement())
        uniqueStringField   String  @unique
        optionalStringField String?
        dateField           DateTime
      }
    `;
    await generateCodeFromSchema(prismaSchema, { outputDirPath });
  });

  it("should expose in GraphQL schema only actions chosen by single resolvers", async () => {
    const { CreateOneUserResolver, FindManyUserResolver } = require(
      outputDirPath + "/index",
    );
    const schema = await buildNestSchema([
      CreateOneUserResolver,
      FindManyUserResolver,
    ]);
    const graphQLSchemaSDL = printSchema(schema);

    expect(graphQLSchemaSDL).toMatchSnapshot("graphQLSchemaSDL");
  }, 60000);
});
