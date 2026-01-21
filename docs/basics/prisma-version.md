---
title: Prisma version verification
sidebar_label: Prisma version check
sidebar_position: 4
---

## Checking installed Prisma version

`typegraphql-prisma-nestjs` generator works only with selected versions of Prisma.
By default, it checks if the installed Prisma version matches the required one using semver rules.

### Version Compatibility

| Generator Version | Prisma Version | Status |
|-------------------|----------------|--------|
| `1.x` | Prisma `^7.0.0` | Current |
| `0.x` | Prisma `^6.0.0` | Maintained |

When you try to use an incompatible version, you will receive an error about wrong package version, e.g:

```sh
Error: Looks like an incorrect version "6.0.0" of the Prisma packages has been installed.
'typegraphql-prisma-nestjs' works only with selected versions, so please ensure
that you have installed a version of Prisma that meets the requirement: "^7.0.0".
Find out more about that requirement in docs:
https://prisma.typegraphql.com/docs/basics/prisma-version
```

The reason of such restriction is that `typegraphql-prisma-nestjs` heavily relies on the DMMF and Prisma generators feature which are not considered a public API, so that there's no guarantee about them having no breaking changes in minor releases.
In plenty of previous releases, changes done in Prisma and DMMF impacted the generator a lot, so that it produced e.g. invalid classes or even broke completely.

So in order to prevent users from creating issues on GitHub, when they install an incompatible version of Prisma, such version check has been implemented and is performed by default. However, when you are sure what you're doing, you can lift the Prisma version restriction and try to use the generator with other Prisma versions.

## Lifting Prisma version restriction

If you want or need to try other version of Prisma, you can use `SKIP_PRISMA_VERSION_CHECK` env variable to suppress that error:

```sh
SKIP_PRISMA_VERSION_CHECK=true npx prisma generate
```

This way there will be no Prisma version check performed and no error thrown. However, using this mode means you are not allowed to report any bug issues as only selected Prisma versions are supported by the `typegraphql-prisma` generator.
