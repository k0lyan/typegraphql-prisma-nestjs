# Fork of [typegraphql-prisma](https://www.npmjs.com/package/typegraphql-prisma)

This project is a fork of another with minor changes, created for personal use.

Long term support is not guaranteed, use of this copy is at your own risk.

## Installation

```
npm install typegraphql-prisma-nestjs --save-dev
```

## Differences from the original project:

### Functions and classes used in generated files from scheme of [prisma](https://github.com/prisma/prisma), imports from [nestjs](https://nestjs.com)

Original:

```typescript
import { Ctx, Query, Resolver } from "type-graphql";
```

In fork:

```typescript
import { Context, Query, Resolver } from "@nestjs/graphql";
```

### Append transformArgsIntoPrismaArgs and setTransformArgsIntoPrismaArgs for modify args before send it to prisma

PR: https://github.com/MichalLytek/typegraphql-prisma/pull/399

Sample fork with this integrations: https://github.com/EndyKaufman/typegraphql-prisma-nestjs/commit/f80d055a9aad227502d023c673ba9eed28d5cc9b

Sample application with this feature: https://github.com/EndyKaufman/typegraphql-prisma-nestjs-example/commit/c43118e952bee58e2620f159fcc62c2595a9189b

![image](https://github.com/MichalLytek/typegraphql-prisma/assets/4127109/edbba60a-ad6b-40b9-8f53-5ff34a1e8a6c)

### Add support mark part of fields as optional

```
@TypeGraphQL.optional(input: ["create", "update"])
```

### Add support call some async events after request to Prisma

```ts
setTransformArgsIntoPrismaArgs(async function <
  TArgs = Record<string, any>,
  TContext = any,
>(
  info: GraphQLResolveInfo,
  args: TArgs,
  ctx: TContext,
  modelName?: string,
  collectionName?: string,
  prismaMethod?: string,
  afterProcessEvents?: ((result: any) => Promise<any>)[],
): Promise<TArgs> {
  // ...some logic before request to prisma
  afterProcessEvents?.push(async function (result) {
    // ...some logic after request to prisma, variable result store output data
  });
  return args;
});
```

### Add options for skip generate methods and fields resolvers

```
emitActions: 'findUnique, findUniqueOrThrow, findFirst, findFirstOrThrow, findMany, createOne, createMany, createManyAndReturn, updateOne, updateMany, deleteOne, deleteMany, upsertOne, aggregate, groupBy'

emitPropertyMethods: 'create, connectOrCreate, upsert, set, disconnect, delete, connect, update, updateMany, deleteMany'
```

### Add option to enable using Dataloader when retrieving nested objects

```
useDataloaderForResolveFields: 'true' // use dataloader for entities
useDataloaderForAllResolveFields: 'true' // use dataloader for array of entities
```

## Example use NestJS + Prisma2 + Typegraphql

https://github.com/EndyKaufman/typegraphql-prisma-nestjs-example

---

![integration logo](https://raw.githubusercontent.com/EndyKaufman/typegraphql-prisma-nestjs/prisma/img/integration.png)

[![discord](https://img.shields.io/discord/1195751245386875040?logo=discord&color=%237289da)](https://discord.gg/cWnBAQcbg2)
[![npm](https://img.shields.io/npm/v/typegraphql-prisma?logo=npm&color=%23CC3534)](https://www.npmjs.com/package/typegraphql-prisma)

# TypeGraphQL & Prisma integration

Prisma generator to emit TypeGraphQL types and CRUD resolvers from your Prisma schema.

[**https://prisma.typegraphql.com**](https://prisma.typegraphql.com)

## Documentation

The documentation, installation guide, detailed description of the API and all of its features is [available on the website](https://prisma.typegraphql.com).

## Examples

You can check out some usage examples on this repo:

https://github.com/EndyKaufman/typegraphql-prisma-nestjs-example

## Feedback

Currently released version `0.x` is just a preview of the upcoming integration. For now it lacks some customization option - picking models or fields of object types to expose in the schema, hiding input fields as well as picking exposed args fields. However, the base functionality is working well, so I strongly encourage you to give it a try and play with it.

Any feedback about the developers experience or ideas about new features or enhancements are very welcome - please feel free to put your two cents by using the [GitHub Discussions feature](https://github.com/MichalLytek/typegraphql-prisma/discussions/new):

<img src="https://raw.githubusercontent.com/MichalLytek/typegraphql-prisma/main/img/feedback.png" width="327"/>

## Security contact information

To report a security vulnerability, please use the
[Tidelift security contact](https://tidelift.com/security).
Tidelift will coordinate the fix and disclosure.

## Future of this project

This project is not sponsored by Prisma anymore, so there will be provided only bug fixes and Prisma compatibility upgrades.
You can read more about this in the GitHub issue [#385](https://github.com/MichalLytek/typegraphql-prisma/issues/385).

Let's keep `typegraphql-prisma` alive together! 💪

## Community

- Visit the [Official Website](https://prisma.typegraphql.com)
- Chat on [Discord](https://discord.gg/cWnBAQcbg2)
