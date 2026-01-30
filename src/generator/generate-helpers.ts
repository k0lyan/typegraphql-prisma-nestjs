import {
  generateGraphQLFieldsImport,
  generateGraphQLInfoImport,
} from "./imports";

import { GeneratorOptions } from "./options";
import { SourceFile } from "ts-morph";

export function generateHelpersFile(
  sourceFile: SourceFile,
  options: GeneratorOptions,
) {
  generateGraphQLInfoImport(sourceFile);
  generateGraphQLFieldsImport(sourceFile);
  sourceFile.addImportDeclaration({
    moduleSpecifier: "dataloader",
    namespaceImport: "DataLoader",
  });

  sourceFile.addStatements(/* ts */ `
    export function transformInfoIntoPrismaArgs(info: GraphQLResolveInfo, modelName?: string, collectionName?: string, prismaMethod?: string, isResolveField?: boolean): Record<string, any> {
      const fields: Record<string, any> = graphqlFields(
        // suppress GraphQLResolveInfo types issue
        info as any,
        {},
        {
          excludedFields: ['__typename'],
          processArguments: true,
        }
      );
      return transformFields(fields, modelName, collectionName, prismaMethod, isResolveField);
    }
  `);

  sourceFile.addStatements(/* ts */ `
    function transformFields(fields: Record<string, any>, modelName?: string, collectionName?: string, prismaMethod?: string, isResolveField?: boolean): Record<string, any> {
      return Object.fromEntries(
        Object.entries(fields)
          .map<[string, any]>(([key, value]) => {
            if (Object.keys(value).length === 0) {
              return [key, true];
            }
            if ("__arguments" in value) {
              return [key, Object.fromEntries(
                value.__arguments.map((argument: object) => {
                  const [[key, { value }]] = Object.entries(argument);
                  return [key, value];
                })
              )];
            }
            return [key, transformFields(value, modelName, collectionName, prismaMethod, isResolveField)];
          }),
      );
    }
  `);

  sourceFile.addStatements(/* ts */ `
    export function getPrismaFromContext(context: any) {
      const prismaClient = context["${options.contextPrismaKey}"];
      if (!prismaClient) {
        throw new Error("Unable to find Prisma Client in GraphQL context. Please provide it under the \`context[\\"${options.contextPrismaKey}\\"]\` key.");
      }
      return prismaClient;
    }
  `);

  sourceFile.addStatements(/* ts */ `
    export function transformCountFieldIntoSelectRelationsCount(_count: object, modelName?: string, collectionName?: string, prismaMethod?: string, isResolveField?: boolean) {
      return {
        include: {
          _count: {
            select: {
              ...Object.fromEntries(
                Object.entries(_count).filter(([_, v]) => v != null)
              ),
            }
          },
        },
      }
    }
  `);

  sourceFile.addStatements(/* ts */ `
    export let transformArgsIntoPrismaArgs = async function <TArgs = Record<string, any>, TContext = any>(info: GraphQLResolveInfo, args: TArgs, ctx: TContext, modelName?: string, collectionName?: string, prismaMethod?: string, afterProcessEvents?: ((result:any) => Promise<any>)[], isResolveField?: boolean): Promise<TArgs> {
        return args;
    };

    export function setTransformArgsIntoPrismaArgs(newTransformArgsIntoPrismaArgs: typeof transformArgsIntoPrismaArgs) {
        transformArgsIntoPrismaArgs = newTransformArgsIntoPrismaArgs;
    }
  `);

  sourceFile.addStatements(/* ts */ `
/**
 * Simple inline dataloader factory for type-graphql resolvers
 * Creates a dataloader per request context
 */
export function InlineLoader<ID, Type>(
  createLoader: (ctx: any) => DataLoader<ID, Type>,
  _target: any,
  _propertyKey: string,
  parameterIndex: number
) {
  // This is a parameter decorator that creates dataloaders
  // The actual loader creation happens at runtime in the resolver
}

/**
 * Helper to get or create a dataloader from context
 */
export function getOrCreateLoader<ID, Type>(
  ctx: any,
  loaderKey: string,
  createLoader: () => DataLoader<ID, Type>
): DataLoader<ID, Type> {
  if (!ctx._dataloaders) {
    ctx._dataloaders = new Map();
  }
  if (!ctx._dataloaders.has(loaderKey)) {
    ctx._dataloaders.set(loaderKey, createLoader());
  }
  return ctx._dataloaders.get(loaderKey);
}
  `);

  // Add optimized Prisma query builder functions
  sourceFile.addStatements(/* ts */ `
/**
 * Checks if a value represents a relation (nested object with fields)
 */
function isRelationField(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

/**
 * Transforms GraphQL requested fields into Prisma select format.
 * Recursively handles nested relations.
 *
 * @example
 * Input (from transformInfoIntoPrismaArgs):
 * {
 *   "id": true,
 *   "name": true,
 *   "City": { "id": true, "name": true },
 *   "posts": { "id": true, "title": true }
 * }
 *
 * Output:
 * {
 *   id: true,
 *   name: true,
 *   City: { select: { id: true, name: true } },
 *   posts: { select: { id: true, title: true } }
 * }
 */
export function transformFieldsToSelect(
  fields: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    // Skip internal fields
    if (key.startsWith('_')) {
      continue;
    }

    if (value === true) {
      // Scalar field
      result[key] = true;
    } else if (isRelationField(value)) {
      // Relation field - recursively build nested select
      result[key] = {
        select: transformFieldsToSelect(value),
      };
    }
  }

  return result;
}

/**
 * Transform fields into include format (includes all scalars, just defines relations)
 * This is less optimized but simpler when you need all scalar fields.
 *
 * @example
 * Input:
 * {
 *   "id": true,
 *   "City": { "id": true, "name": true }
 * }
 *
 * Output:
 * {
 *   City: { select: { id: true, name: true } }
 * }
 */
export function transformFieldsToInclude(
  fields: Record<string, any>,
): Record<string, any> | undefined {
  const include: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (key.startsWith('_')) {
      continue;
    }

    if (isRelationField(value)) {
      include[key] = {
        select: transformFieldsToSelect(value),
      };
    }
  }

  return Object.keys(include).length > 0 ? include : undefined;
}

/**
 * Builds an optimized Prisma query from GraphQL args and info.
 * Uses select for precise field selection including relations.
 *
 * @example
 * \`\`\`typescript
 * const prismaQuery = buildPrismaQueryFromArgs(args, info);
 * const results = await prisma.user.findMany(prismaQuery);
 * \`\`\`
 */
export function buildPrismaQueryFromArgs<TArgs extends Record<string, any>>(
  args: TArgs,
  info: GraphQLResolveInfo,
  additionalWhere?: Record<string, any>,
): TArgs & { select?: Record<string, any> } {
  const fields = transformInfoIntoPrismaArgs(info);
  const select = transformFieldsToSelect(fields);

  const result: any = { ...args };

  if (Object.keys(select).length > 0) {
    result.select = select;
  }

  // Merge additional where conditions
  if (additionalWhere) {
    result.where = {
      ...result.where,
      ...additionalWhere,
    };
  }

  return result;
}

/**
 * Builds a Prisma query using include instead of select.
 * Use this when you want all scalar fields plus specific relations.
 *
 * @example
 * \`\`\`typescript
 * const prismaQuery = buildPrismaQueryFromArgsWithInclude(args, info);
 * const results = await prisma.user.findMany(prismaQuery);
 * \`\`\`
 */
export function buildPrismaQueryFromArgsWithInclude<
  TArgs extends Record<string, any>,
>(
  args: TArgs,
  info: GraphQLResolveInfo,
  additionalWhere?: Record<string, any>,
): TArgs & { include?: Record<string, any> } {
  const fields = transformInfoIntoPrismaArgs(info);
  const include = transformFieldsToInclude(fields);

  const result: any = { ...args };

  if (include) {
    result.include = include;
  }

  // Merge additional where conditions
  if (additionalWhere) {
    result.where = {
      ...result.where,
      ...additionalWhere,
    };
  }

  return result;
}
  `);
}
