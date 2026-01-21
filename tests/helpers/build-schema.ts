import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from "@nestjs/graphql";
import { Test } from "@nestjs/testing";
import type { Type } from "@nestjs/common";
import type { GraphQLSchema } from "graphql";
import { mapSchema, MapperKind } from "@graphql-tools/utils";

// Store module refs to close them after use
let lastModuleRef: any = null;

/**
 * Clear the NestJS GraphQL metadata storages to prevent type conflicts
 * when building multiple schemas in tests.
 * This must be called BEFORE importing resolver files.
 */
export function clearMetadataStorages() {
  try {
    const globalRef = global as any;

    // Clear TypeMetadataStorage - the main storage for GraphQL types
    const typeMetaStoragePath =
      "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage";
    delete require.cache[require.resolve(typeMetaStoragePath)];
    const { TypeMetadataStorageHost } = require(typeMetaStoragePath);
    globalRef.GqlTypeMetadataStorage = new TypeMetadataStorageHost();

    // Clear LazyMetadataStorage
    try {
      const lazyMetaStoragePath =
        "@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage";
      delete require.cache[require.resolve(lazyMetaStoragePath)];
      const { LazyMetadataStorageHost } = require(lazyMetaStoragePath);
      globalRef.GqlLazyMetadataStorageHost = new LazyMetadataStorageHost();
    } catch {
      // Ignore if this storage doesn't exist in the version
    }
  } catch (error) {
    console.warn("Warning: Could not clear metadata storages:", error);
  }
}

/**
 * Clear Node.js require cache for modules matching a pattern.
 */
export function clearRequireCache(pattern: string) {
  Object.keys(require.cache).forEach(key => {
    if (key.includes(pattern)) {
      delete require.cache[key];
    }
  });
}

/**
 * Clear all test artifacts and NestJS decorator caches to allow
 * building a fresh schema without type name conflicts.
 * This must be called BEFORE importing any resolver files.
 *
 * Note: Due to NestJS GraphQL's global metadata storage, tests that use
 * different schemas with the same type names must run in separate Jest processes.
 */
export function resetForNewSchema() {
  // Clear require cache for test artifacts
  clearRequireCache("/tests/artifacts/");

  // Reset global metadata storages
  const globalRef = global as any;
  try {
    const typeMetaStoragePath =
      "@nestjs/graphql/dist/schema-builder/storages/type-metadata.storage";
    const { TypeMetadataStorageHost } = require(typeMetaStoragePath);
    globalRef.GqlTypeMetadataStorage = new TypeMetadataStorageHost();
  } catch {
    // Ignore
  }
}

/**
 * Load a resolver from a generated path, clearing caches first.
 */
export function loadResolver<T>(
  outputDirPath: string,
  resolverPath: string,
  exportName: string,
): T {
  // Clear metadata and require cache before loading
  clearMetadataStorages();
  clearRequireCache("/tests/artifacts/");

  const fullPath = outputDirPath + resolverPath;
  const module = require(fullPath);
  return module[exportName];
}

/**
 * Build a GraphQL schema from NestJS GraphQL resolvers.
 * This is the NestJS equivalent of type-graphql's buildSchema function.
 *
 * NestJS's GraphQLSchemaFactory.create() only generates the schema types,
 * not the resolver implementations. We use mapSchema to manually wire up
 * the resolver methods to make the schema executable.
 */
export async function buildNestSchema(
  resolvers: Type<any>[],
): Promise<GraphQLSchema> {
  // Close previous module if exists
  if (lastModuleRef) {
    await lastModuleRef.close();
  }

  const moduleRef = await Test.createTestingModule({
    imports: [GraphQLSchemaBuilderModule],
    providers: resolvers,
  }).compile();

  lastModuleRef = moduleRef;

  const gqlSchemaFactory = moduleRef.get(GraphQLSchemaFactory);
  let schema = await gqlSchemaFactory.create(resolvers, { skipCheck: true });

  // Get resolver instances from the module
  const resolverInstances = resolvers.map(r => moduleRef.get(r));

  // Build a map of all methods from all resolvers
  const methodMap = new Map<string, { instance: any; method: Function }>();
  for (const instance of resolverInstances) {
    const proto = Object.getPrototypeOf(instance);
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      name => name !== "constructor" && typeof proto[name] === "function",
    );
    for (const name of methodNames) {
      methodMap.set(name, { instance, method: proto[name] });
    }
  }

  // Wire up resolvers using mapSchema from graphql-tools
  schema = mapSchema(schema, {
    [MapperKind.QUERY_ROOT_FIELD]: (fieldConfig, fieldName) => {
      const entry = methodMap.get(fieldName);
      if (entry) {
        fieldConfig.resolve = async (
          root: any,
          args: any,
          context: any,
          info: any,
        ) => {
          // Call the resolver method with NestJS-style args (ctx, info, args)
          return entry.method.call(entry.instance, context, info, args);
        };
      }
      return fieldConfig;
    },
    [MapperKind.MUTATION_ROOT_FIELD]: (fieldConfig, fieldName) => {
      const entry = methodMap.get(fieldName);
      if (entry) {
        fieldConfig.resolve = async (
          root: any,
          args: any,
          context: any,
          info: any,
        ) => {
          return entry.method.call(entry.instance, context, info, args);
        };
      }
      return fieldConfig;
    },
  });

  return schema;
}
