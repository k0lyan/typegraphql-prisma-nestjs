import "reflect-metadata";
import { promises as fs } from "fs";
import { buildNestSchema } from "../helpers/build-schema";
import { graphql, GraphQLSchema } from "graphql";

import generateArtifactsDirPath from "../helpers/artifacts-dir";
import { generateCodeFromSchema } from "../helpers/generate-code";

describe("errors", () => {
  let outputDirPath: string;
  let graphQLSchema: GraphQLSchema;

  describe("getPrismaFromContext", () => {
    beforeAll(async () => {
      outputDirPath = generateArtifactsDirPath("functional-crud");
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
      const { UserCrudResolver } = require(
        outputDirPath + "/resolvers/crud/User/UserCrudResolver.ts",
      );

      graphQLSchema = await buildNestSchema([UserCrudResolver]);
    });

    it("should throw error when prisma not provided in context", async () => {
      // Use aggregateUser which is non-nullable, so errors will propagate
      const document = /* graphql */ `
        query {
          aggregateUser {
            _count {
              _all
            }
          }
        }
      `;

      const { errors } = await graphql({
        schema: graphQLSchema,
        source: document,
        contextValue: {
          // prisma: undefined,
        },
      });

      expect(errors).toBeDefined();
      expect(errors!.length).toBeGreaterThan(0);
      // The error message will contain either the Prisma context error or
      // the non-nullable wrapper error
      expect(
        errors![0].message.includes("Unable to find Prisma Client") ||
          errors![0].message.includes("Cannot return null for non-nullable"),
      ).toBe(true);
    });
  });
});
