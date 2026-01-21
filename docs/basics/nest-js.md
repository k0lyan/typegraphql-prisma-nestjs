---
title: Nest JS
sidebar_position: 5
---

## NestJS GraphQL Integration

`typegraphql-prisma-nestjs` generates code that uses `@nestjs/graphql` decorators directly, making it fully compatible with NestJS GraphQL applications.

The generated resolvers and types can be used directly with `@nestjs/graphql` without any additional adapters.

### Installation

```sh
npm i @nestjs/graphql @nestjs/apollo @apollo/server graphql
```

### Usage

```typescript
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { resolvers } from '@generated/type-graphql';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
    }),
  ],
  providers: [...resolvers],
})
export class AppModule {}
```

You can find an example in the [`examples/4-nest-js` folder](https://github.com/EndyKaufman/typegraphql-prisma-nestjs/tree/main/examples/4-nest-js).
