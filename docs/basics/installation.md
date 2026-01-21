---
title: Installation
sidebar_position: 1
---

:::info
Be aware that due to usage of some ES2021 and newer Node.js features, you also have to use **Node.js v18.x or newer** for version 1.x (Prisma 7), or **Node.js v16.13.0 or newer** for version 0.x (Prisma 6).
:::

### TypeGraphQL

First of all, you should perform all the steps described in the TypeGraphQL installation instruction:

https://typegraphql.com/docs/installation.html

### `typegraphql-prisma` generator

After that, you have to install the generator, as a dev dependency:

```sh
# For Prisma 7.x (recommended)
npm i -D typegraphql-prisma-nestjs@^1.0.0

# For Prisma 6.x (legacy)
npm i -D typegraphql-prisma-nestjs@^0.28.0
```

Furthermore, `typegraphql-prisma-nestjs` requires Prisma to work properly, so please install Prisma dependencies if you don't have it already installed:

```sh
# For Prisma 7.x
npm i -D prisma@^7.0.0
npm i @prisma/client@^7.0.0

# For Prisma 6.x
npm i -D prisma@^6.0.0
npm i @prisma/client@^6.0.0
```

:::caution
Be aware that `typegraphql-prisma-nestjs` is designed to work with specific versions of Prisma:

| Generator Version | Prisma Version |
|-------------------|----------------|
| `1.x` | Prisma `^7.0.0` |
| `0.x` | Prisma `^6.0.0` |

Make sure you install the correct generator version for your Prisma version.
If you encounter issues with a new Prisma feature not supported yet, please check on GitHub issues and create a new issue if that wasn't already reported.

:::

### Additional dependencies

You also need to install the GraphQL Scalars library (to support the Prisma `Json`, `BigInt` and `Byte` types):

```sh
npm i graphql-scalars
```

In order to properly support the aggregate and group by queries, the `graphql-fields` package is used, so it also has to be installed:

```sh
npm i graphql-fields @types/graphql-fields
```

Finally, please also install the `tslib` package, which is required for [applying the additional decorators](../advanced/additional-decorators.md) properly:

```sh
npm i tslib
```

### TypeScript configuration

As prisma emits multiple files, make sure you have your tsconfig set properly to `"module": "commonjs"`:

```json {4}
{
  "compilerOptions": {
    "target": "es2021",
    "module": "commonjs",
    "lib": ["es2021"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Otherwise you may experience runtime errors like `ReferenceError: Cannot access 'BankAccountWhereInput' before initialization`.
It's because those generated files rely on each other, so `commonjs` is needed to handle that cyclic imports.
