import { MethodDeclarationStructure, OptionalKind, Writers } from "ts-morph";

import { DMMF } from "../dmmf/types";
import { DmmfDocument } from "../dmmf/dmmf-document";
import { GeneratorOptions } from "../options";

// Actions that should use optimized select-based queries
const SELECT_OPTIMIZED_ACTIONS = new Set([
  DMMF.ModelAction.findUnique,
  DMMF.ModelAction.findUniqueOrThrow,
  DMMF.ModelAction.findFirst,
  DMMF.ModelAction.findFirstOrThrow,
  DMMF.ModelAction.findMany,
]);

export function generateCrudResolverClassMethodDeclaration(
  action: DMMF.Action,
  mapping: DMMF.ModelMapping,
  dmmfDocument: DmmfDocument,
  generatorOptions: GeneratorOptions,
): OptionalKind<MethodDeclarationStructure> {
  return {
    name: action.name,
    isAsync: true,
    returnType: `Promise<${action.returnTSType}>`,
    decorators: [
      {
        name: `${action.operation}`,
        arguments: [
          `(_returns: any) => ${action.typeGraphQLType}`,
          Writers.object({
            nullable: `${!action.method.isRequired}`,
          }),
        ],
      },
    ],
    parameters: [
      {
        name: "ctx",
        // TODO: import custom `ContextType`
        type: "any",
        decorators: [{ name: "Context", arguments: [] }],
      },
      {
        name: "info",
        type: "GraphQLResolveInfo",
        decorators: [{ name: "Info", arguments: [] }],
      },
      ...(!action.argsTypeName
        ? []
        : [
            {
              name: "args",
              type: action.argsTypeName,
              decorators: [
                {
                  name: "Args",
                  arguments: generatorOptions.emitRedundantTypesInfo
                    ? [`(_type: any) => ${action.argsTypeName}`]
                    : [],
                },
              ],
            },
          ]),
    ],
    statements: generateResolverStatements(action, mapping),
  };
}

function generateResolverStatements(
  action: DMMF.Action,
  mapping: DMMF.ModelMapping,
): string[] {
  if (action.kind === DMMF.ModelAction.aggregate) {
    return [
      /* ts */ `const afterProcessEvents: ((result:any) => Promise<any>)[] = [];`,
      /* ts */ `const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, ctx, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}', afterProcessEvents);`,
      /* ts */ `const transformedInfoIntoPrismaArgs = transformInfoIntoPrismaArgs(info, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
      /* ts */ `const result = await getPrismaFromContext(ctx).${mapping.collectionName}.${action.prismaMethod}({ ...transformedArgsIntoPrismaArgs, ...transformedInfoIntoPrismaArgs, });`,
      /* ts */ `for (const afterProcessEvent of afterProcessEvents){ await afterProcessEvent(result); }`,
      /* ts */ `return result;`,
    ];
  }

  if (action.kind === DMMF.ModelAction.groupBy) {
    return [
      /* ts */ `const afterProcessEvents: ((result:any) => Promise<any>)[] = [];`,
      /* ts */ `const { _count, _avg, _sum, _min, _max } = transformInfoIntoPrismaArgs(info, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
      /* ts */ `const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, ctx, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}', afterProcessEvents);`,
      /* ts */ `const groupByArgs = Object.fromEntries( Object.entries({ _count, _avg, _sum, _min, _max }).filter(([_, v]) => v != null));`,
      /* ts */ `const result = await getPrismaFromContext(ctx).${mapping.collectionName}.${action.prismaMethod}({ ...transformedArgsIntoPrismaArgs, ...groupByArgs,});`,
      /* ts */ `for (const afterProcessEvent of afterProcessEvents){ await afterProcessEvent(result); }`,
      /* ts */ `return result;`,
    ];
  }

  // Use optimized select-based queries for find operations
  if (SELECT_OPTIMIZED_ACTIONS.has(action.kind)) {
    return [
      /* ts */ `const afterProcessEvents: ((result:any) => Promise<any>)[] = [];`,
      /* ts */ `const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, ctx, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}', afterProcessEvents);`,
      /* ts */ `const prismaQuery = buildPrismaQueryFromArgs(transformedArgsIntoPrismaArgs, info);`,
      /* ts */ `const result = await getPrismaFromContext(ctx).${mapping.collectionName}.${action.prismaMethod}(prismaQuery);`,
      /* ts */ `for (const afterProcessEvent of afterProcessEvents){ await afterProcessEvent(result); }`,
      /* ts */ `return result;`,
    ];
  }

  // Default behavior for other operations (create, update, delete, etc.)
  return [
    /* ts */ ` const afterProcessEvents: ((result:any) => Promise<any>)[] = [];`,
    /* ts */ ` const { _count } = transformInfoIntoPrismaArgs(info, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
    /* ts */ ` const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, ctx, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}', afterProcessEvents);`,
    /* ts */ ` const otherArgs = _count && transformCountFieldIntoSelectRelationsCount(_count, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
    /* ts */ ` const result = await getPrismaFromContext(ctx).${mapping.collectionName}.${action.prismaMethod}({ ...transformedArgsIntoPrismaArgs, ...otherArgs, });`,
    /* ts */ ` for (const afterProcessEvent of afterProcessEvents){ await afterProcessEvent(result); }`,
    /* ts */ `return result;`,
  ];
}
