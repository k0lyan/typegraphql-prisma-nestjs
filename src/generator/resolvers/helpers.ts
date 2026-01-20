import { OptionalKind, MethodDeclarationStructure, Writers } from "ts-morph";

import { DmmfDocument } from "../dmmf/dmmf-document";
import { DMMF } from "../dmmf/types";
import { GeneratorOptions } from "../options";

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
          `_returns => ${action.typeGraphQLType}`,
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
                    ? [`_type => ${action.argsTypeName}`]
                    : [],
                },
              ],
            },
          ]),
    ],
    statements:
      action.kind === DMMF.ModelAction.aggregate
        ? [
            /* ts */ `const afterProcessEvents: ((result:any) => Promise<any>)[] = [];`,
            /* ts */ `const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, ctx, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}', afterProcessEvents);`,
            /* ts */ `const transformedInfoIntoPrismaArgs = transformInfoIntoPrismaArgs(info, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
            /* ts */ `const result = await getPrismaFromContext(ctx).${mapping.collectionName}.${action.prismaMethod}({ ...transformedArgsIntoPrismaArgs, ...transformedInfoIntoPrismaArgs, });`,
            /* ts */ `for (const afterProcessEvent of afterProcessEvents){ await afterProcessEvent(result); }`,
            /* ts */ `return result;`,
          ]
        : action.kind === DMMF.ModelAction.groupBy
          ? [
              /* ts */ `const afterProcessEvents: ((result:any) => Promise<any>)[] = [];`,
              /* ts */ `const { _count, _avg, _sum, _min, _max } = transformInfoIntoPrismaArgs(info, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
              /* ts */ `const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, ctx, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}', afterProcessEvents);`,
              /* ts */ `const groupByArgs = Object.fromEntries( Object.entries({ _count, _avg, _sum, _min, _max }).filter(([_, v]) => v != null));`,
              /* ts */ `const result = await getPrismaFromContext(ctx).${mapping.collectionName}.${action.prismaMethod}({ ...transformedArgsIntoPrismaArgs, ...groupByArgs,});`,
              /* ts */ `for (const afterProcessEvent of afterProcessEvents){ await afterProcessEvent(result); }`,
              /* ts */ `return result;`,
            ]
          : [
              /* ts */ ` const afterProcessEvents: ((result:any) => Promise<any>)[] = [];`,
              /* ts */ ` const { _count } = transformInfoIntoPrismaArgs(info, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
              /* ts */ ` const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, ctx, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}', afterProcessEvents);`,
              /* ts */ ` const otherArgs = _count && transformCountFieldIntoSelectRelationsCount(_count, '${mapping.modelName}', '${mapping.collectionName}', '${action.prismaMethod}');`,
              /* ts */ ` const result = await getPrismaFromContext(ctx).${mapping.collectionName}.${action.prismaMethod}({ ...transformedArgsIntoPrismaArgs, ...otherArgs, });`,
              /* ts */ ` for (const afterProcessEvent of afterProcessEvents){ await afterProcessEvent(result); }`,
              /* ts */ `return result;`,
            ],
  };
}
