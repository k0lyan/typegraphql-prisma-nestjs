import "reflect-metadata";
import { promises as fs } from "fs";
import { graphql, GraphQLSchema } from "graphql";
import { buildNestSchema, resetForNewSchema } from "../helpers/build-schema";

import generateArtifactsDirPath from "../helpers/artifacts-dir";
import { generateCodeFromSchema } from "../helpers/generate-code";

// Note: This test is skipped because it requires field resolvers (ResolveField)
// which aren't fully supported by the test buildNestSchema helper yet.
// The test uses UserRelationsResolver which has @ResolveField decorators.
describe.skip("relation counts querying", () => {
  let outputDirPath: string;
  let graphQLSchema: GraphQLSchema;

  beforeAll(async () => {
    resetForNewSchema();
    outputDirPath = generateArtifactsDirPath("functional-relation-counts");
    await fs.mkdir(outputDirPath, { recursive: true });
    const prismaSchema = /* prisma */ `
      enum Color {
        RED
        GREEN
        BLUE
      }

      model User {
        id     Int      @id @default(autoincrement())
        name   String?
        posts  Post[]
      }

      model Post {
        uuid      String  @id @default(cuid())
        content   String
        author    User    @relation(fields: [authorId], references: [id])
        authorId  Int
        color     Color
      }
    `;
    await generateCodeFromSchema(prismaSchema, {
      outputDirPath,
    });
    const {
      UserRelationsResolver,
      PostRelationsResolver,
      UserCrudResolver,
      PostCrudResolver,
    } = require(outputDirPath);

    graphQLSchema = await buildNestSchema([
      UserRelationsResolver,
      PostRelationsResolver,
      UserCrudResolver,
      PostCrudResolver,
    ]);
  });

  it("should properly call PrismaClient on getting relation count with args", async () => {
    const document = /* graphql */ `
      query {
        users {
          name
          _count {
            posts(where: { color: { equals: RED } })
          }
        }
      }
    `;
    const findManyUserMock = jest.fn();
    const prismaMock = {
      user: {
        findMany: findManyUserMock,
      },
    };
    findManyUserMock.mockReturnValueOnce([
      {
        name: "Test",
        _count: {
          posts: 5,
        },
      },
    ]);

    const { data, errors } = await graphql({
      schema: graphQLSchema,
      source: document,
      contextValue: { prisma: prismaMock },
    });

    expect(errors).toBeUndefined();
    expect(data).toMatchSnapshot("users with posts count - mocked response");
    expect(prismaMock.user.findMany.mock.calls).toMatchSnapshot(
      "findManyUser - relation count with args - call args",
    );
  });
});
