import {
  OptionalKind,
  MethodDeclarationStructure,
  Project,
  Writers,
} from "ts-morph";
import path from "path";

import { camelCase } from "../helpers";
import { resolversFolderName, relationsResolversFolderName } from "../config";
import {
  generateTypeGraphQLImport,
  generateArgsImports,
  generateModelsImports,
  generateHelpersFileImport,
  generateGraphQLInfoImport,
} from "../imports";
import { DmmfDocument } from "../dmmf/dmmf-document";
import { DMMF } from "../dmmf/types";
import { GeneratorOptions } from "../options";

export default function generateRelationsResolverClassesFromModel(
  project: Project,
  baseDirPath: string,
  dmmfDocument: DmmfDocument,
  { model, relationFields, resolverName }: DMMF.RelationModel,
  generatorOptions: GeneratorOptions,
) {
  const rootArgName = camelCase(model.typeName);
  const singleIdField = model.fields.find(field => field.isId);
  const singleUniqueField = model.fields.find(field => field.isUnique);
  const singleFilterField = singleIdField ?? singleUniqueField;
  const compositeIdFields =
    model.primaryKey?.fields.map(
      idField => model.fields.find(field => idField === field.name)!,
    ) ?? [];
  const compositeUniqueFields = model.uniqueIndexes[0]
    ? model.uniqueIndexes[0].fields.map(
        uniqueField => model.fields.find(field => uniqueField === field.name)!,
      )
    : [];
  const compositeFilterFields =
    compositeIdFields.length > 0 ? compositeIdFields : compositeUniqueFields;

  const resolverDirPath = path.resolve(
    baseDirPath,
    resolversFolderName,
    relationsResolversFolderName,
    model.typeName,
  );
  const filePath = path.resolve(resolverDirPath, `${resolverName}.ts`);
  const sourceFile = project.createSourceFile(filePath, undefined, {
    overwrite: true,
  });

  generateTypeGraphQLImport(sourceFile);
  generateGraphQLInfoImport(sourceFile);
  generateModelsImports(
    sourceFile,
    [...relationFields.map(field => field.type), model.typeName],
    3,
  );

  const argTypeNames = relationFields
    .filter(it => it.argsTypeName !== undefined)
    .map(it => it.argsTypeName!);
  generateArgsImports(sourceFile, argTypeNames, 0);
  generateHelpersFileImport(sourceFile, 3);

  sourceFile.addImportDeclaration({
    moduleSpecifier: "dataloader",
    namespaceImport: "DataLoader",
  });

  sourceFile.addClass({
    name: resolverName,
    isExported: true,
    decorators: [
      {
        name: "Resolver",
        arguments: [`_of => ${model.typeName}`],
      },
    ],
    methods: relationFields.map<OptionalKind<MethodDeclarationStructure>>(
      field => {
        let whereConditionString: string = "";
        // TODO: refactor to AST
        if (singleFilterField) {
          whereConditionString = `
            ${singleFilterField.name}: ${rootArgName}.${singleFilterField.name},
          `;
        } else if (compositeFilterFields.length > 0) {
          const filterKeyName =
            model.primaryKey?.name ??
            model.uniqueIndexes[0]?.name ??
            compositeFilterFields.map(it => it.name).join("_");
          whereConditionString = `
            ${filterKeyName}: {
              ${compositeFilterFields
                .map(
                  idField => `${idField.name}: ${rootArgName}.${idField.name},`,
                )
                .join("\n")}
            },
          `;
        } else {
          throw new Error(
            `Unexpected error happened on generating 'whereConditionString' for ${model.typeName} relation resolver`,
          );
        }

        const relationFromField = dmmfDocument.relationModels
          .find(m => m.model.name === field.name)
          ?.model?.fields?.find(f => f?.name === model?.name)
          ?.relationFromFields?.[0];

        const relationFromFieldType = dmmfDocument.relationModels
          .find(m => m.model.name === field.name)
          ?.model?.fields?.find(f => f?.isId)?.fieldTSType;

        if (
          generatorOptions.useDataloaderForAllResolveFields ||
          (generatorOptions.useDataloaderForResolveFields &&
            !field.argsTypeName)
        ) {
          const datamapperOptions = [
            generatorOptions.useDataloaderMaxBatchSize !== undefined
              ? `maxBatchSize: ${generatorOptions.useDataloaderMaxBatchSize}`
              : undefined,
            generatorOptions.useDataloaderCache !== undefined
              ? `cache: ${generatorOptions.useDataloaderCache}`
              : undefined,
            generatorOptions.useDataloaderBatchScheduleFnDelay !== undefined
              ? `batchScheduleFn: (cb) => setTimeout(() => process.nextTick(cb), ${generatorOptions.useDataloaderBatchScheduleFnDelay})`
              : undefined,
          ].filter(Boolean);
          const datamapperOptionsText = datamapperOptions.length
            ? `, {${datamapperOptions.join(",")}}`
            : "";
          return {
            name: field.typeFieldAlias ?? field.name,
            isAsync: true,
            returnType: `Promise<${field.fieldTSType}>`,
            decorators: [
              {
                name: "ResolveField",
                arguments: [
                  `_type => ${field.typeGraphQLType}`,
                  Writers.object({
                    nullable: `${!field.isRequired}`,
                    ...(field.docs && { description: `"${field.docs}"` }),
                  }),
                ],
              },
            ],
            parameters: [
              {
                name: rootArgName,
                type: model.typeName,
                decorators: [{ name: "Root", arguments: [] }],
              },
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
              ...((!field.argsTypeName)
                ? []
                : [
                    {
                      name: "args",
                      type: field.argsTypeName,
                      decorators: [
                        {
                          name: "Args",
                          arguments: generatorOptions.emitRedundantTypesInfo
                            ? [`_type => ${field.argsTypeName}`]
                            : [],
                        },
                      ],
                    },
                  ]),
              {
                name: "dataloader",
                type: `DataLoader<${relationFromFieldType || "string"}, ${field.typeFieldAlias ?? field.type}${field.isList ? "[]" : ""}>`,
                decorators: [
                  {
                    name: "InlineLoader",
                    arguments: [
                      `<ID,Type>(context)=>{    
              const graphqlExecutionContext = GqlExecutionContext.create(context);
              const ctx = graphqlExecutionContext.getContext();
              const loader = new DataLoader<ID,Type>(
                async (ids) => {
                    const context = (loader as any).context;
                    const info = (loader as any).info;
                    const args = (loader as any).args;
                    const { _count } = transformInfoIntoPrismaArgs(info, '${model.name}', '${camelCase(model.name)}', 'findMany');
                    const transformedArgsIntoPrismaArgs = await transformArgsIntoPrismaArgs(info, args, context, '${model.name}', '${camelCase(model.name)}', 'findMany', []);
                    const otherArgs = _count && transformCountFieldIntoSelectRelationsCount(_count, '${model.name}', '${camelCase(model.name)}', 'findMany');
                    const allArgs = { ...transformedArgsIntoPrismaArgs, ...otherArgs, };
                    const result:${field.type}[] = await getPrismaFromContext(ctx).${camelCase(field.type)}.findMany({
                      ...allArgs,
                      where: {
                        ...(allArgs.where || {}),
                        ${relationFromField || field.relationToFields?.[0] || "id"}: { in: ids },
                      },
                    });
                    return ids.map(id=>result.${field.isList ? "filter" : "find"}(r=>r.${relationFromField || field.relationToFields?.[0] || "id"}===id)||${field.isList ? "[]" : "null"}) as Type[]
                }${datamapperOptionsText}
              );
              return loader;
            }`,
                    ],
                  },
                ],
              },
            ],
            // TODO: refactor to AST
            statements: [
              "(dataloader as any).info = info;",
              "(dataloader as any).context = ctx;",
              (!field.argsTypeName)
                ? "(dataloader as any).args = {};"
                : "(dataloader as any).args = args;",
              field.isRequired
                ? ` return await dataloader.load(${rootArgName}.${field.relationFromFields?.[0] || "id"});`
                : /* ts */ ` return !${rootArgName}.${field.relationFromFields?.[0] || "id"}?${field.isList ? "[]" : "null"}:await dataloader.load(${rootArgName}.${field.relationFromFields?.[0] || "id"});`,
            ],
          };
        }
        return {
          name: field.typeFieldAlias ?? field.name,
          isAsync: true,
          returnType: `Promise<${field.fieldTSType}>`,
          decorators: [
            {
              name: "ResolveField",
              arguments: [
                `_type => ${field.typeGraphQLType}`,
                Writers.object({
                  nullable: `${!field.isRequired}`,
                  ...(field.docs && { description: `"${field.docs}"` }),
                }),
              ],
            },
          ],
          parameters: [
            {
              name: rootArgName,
              type: model.typeName,
              decorators: [{ name: "Root", arguments: [] }],
            },
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
            ...(!field.argsTypeName
              ? []
              : [
                  {
                    name: "args",
                    type: field.argsTypeName,
                    decorators: [
                      {
                        name: "Args",
                        arguments: generatorOptions.emitRedundantTypesInfo
                          ? [`_type => ${field.argsTypeName}`]
                          : [],
                      },
                    ],
                  },
                ]),
          ],
          // TODO: refactor to AST
          statements: [
            /* ts */ ` const { _count } = transformInfoIntoPrismaArgs(info, '${model.name}', '', '');
            return getPrismaFromContext(ctx).${camelCase(
              model.name,
            )}.findUniqueOrThrow({
              where: {${whereConditionString}},
            }).${field.name}({ ${field.argsTypeName ? "\n...args," : ""}
              ...(_count && transformCountFieldIntoSelectRelationsCount(_count, '${model.name}', '', '')),
            });`,
          ],
        };
      },
    ),
  });
}
