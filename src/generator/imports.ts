import {
  ExportDeclarationStructure,
  OptionalKind,
  SourceFile,
  VariableDeclarationKind,
} from "ts-morph";
import {
  argsFolderName,
  crudResolversFolderName,
  enumsFolderName,
  inputsFolderName,
  modelsFolderName,
  outputsFolderName,
  relationsResolversFolderName,
  resolversFolderName,
} from "./config";

import { EmitBlockKind } from "./emit-block";
import { GenerateMappingData } from "./types";
import { GeneratorOptions } from "./options";
import path from "path";

export function generateTypeGraphQLImport(sourceFile: SourceFile) {
  sourceFile.addImportDeclaration({
    moduleSpecifier: "@nestjs/graphql",
    namedImports: [
      "Args",
      "ArgsType",
      "Context",
      "Field",
      "Float",
      "ID",
      "Info",
      "InputType",
      "Int",
      "Mutation",
      "ObjectType",
      "Parent",
      "Query",
      "registerEnumType",
      "ResolveField",
      "Resolver",
    ].sort(),
  });
}

export function generateForwardRefImport(sourceFile: SourceFile) {
  sourceFile.addImportDeclaration({
    moduleSpecifier: "@nestjs/common",
    namedImports: ["forwardRef"],
  });
}

export function generateGraphQLFieldsImport(sourceFile: SourceFile) {
  sourceFile.addImportDeclaration({
    moduleSpecifier: "graphql-fields",
    defaultImport: "graphqlFields",
  });
}

export function generateGraphQLInfoImport(sourceFile: SourceFile) {
  sourceFile.addImportDeclaration({
    moduleSpecifier: "graphql",
    isTypeOnly: true,
    namedImports: ["GraphQLResolveInfo"],
  });
}

export function generateGraphQLScalarsImport(sourceFile: SourceFile) {
  sourceFile.addImportDeclaration({
    moduleSpecifier: "graphql-scalars",
    namespaceImport: "GraphQLScalars",
  });
}

export function generateGraphQLScalarTypeImport(sourceFile: SourceFile) {
  sourceFile.addImportDeclaration({
    moduleSpecifier: "graphql",
    namedImports: ["GraphQLScalarType"],
  });
}

export function generateCustomScalarsImport(sourceFile: SourceFile, level = 0) {
  sourceFile.addImportDeclaration({
    moduleSpecifier:
      (level === 0 ? "./" : "") +
      path.posix.join(...Array(level).fill(".."), "scalars"),
    namedImports: ["DecimalJSScalar"],
  });
}

export function generateHelpersFileImport(sourceFile: SourceFile, level = 0) {
  sourceFile.addImportDeclaration({
    moduleSpecifier:
      (level === 0 ? "./" : "") +
      path.posix.join(...Array(level).fill(".."), "helpers"),
    namedImports: [
      "transformArgsIntoPrismaArgs",
      "transformInfoIntoPrismaArgs",
      "getPrismaFromContext",
      "transformCountFieldIntoSelectRelationsCount",
      "buildPrismaQueryFromArgs",
      "buildPrismaQueryFromArgsWithInclude",
      "InlineLoader",
    ],
  });
}

export function generatePrismaNamespaceImport(
  sourceFile: SourceFile,
  options: GeneratorOptions,
  level = 0,
) {
  sourceFile.addImportDeclaration({
    moduleSpecifier:
      options.absolutePrismaOutputPath ??
      (!options.customPrismaImportPathIgnoreLevels && level === 0 ? "./" : "") +
        (options.customPrismaImportPathIgnoreLevels
          ? (options.customPrismaImportPath ?? options.relativePrismaOutputPath)
          : path.posix.join(
              ...Array(level).fill(".."),
              options.customPrismaImportPath ??
                options.relativePrismaOutputPath,
            )),
    namedImports: ["Prisma"],
  });
}

export function generateArgsBarrelFile(
  sourceFile: SourceFile,
  argsTypeNames: string[],
) {
  sourceFile.addExportDeclarations(
    argsTypeNames
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>(argTypeName => ({
        moduleSpecifier: `./${argTypeName}`,
        namedExports: [argTypeName],
      })),
  );
}

export function generateArgsIndexFile(
  sourceFile: SourceFile,
  typeNames: string[],
) {
  sourceFile.addExportDeclarations(
    typeNames
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>(typeName => ({
        moduleSpecifier: `./${typeName}/args`,
      })),
  );
}

export function generateModelsBarrelFile(
  sourceFile: SourceFile,
  modelNames: string[],
) {
  sourceFile.addExportDeclarations(
    modelNames
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>(modelName => ({
        moduleSpecifier: `./${modelName}`,
        namedExports: [modelName],
      })),
  );
}

export function generateEnumsBarrelFile(
  sourceFile: SourceFile,
  enumTypeNames: string[],
) {
  sourceFile.addExportDeclarations(
    enumTypeNames
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>(enumTypeName => ({
        moduleSpecifier: `./${enumTypeName}`,
        namedExports: [enumTypeName],
      })),
  );
}

export function generateInputsBarrelFile(
  sourceFile: SourceFile,
  inputTypeNames: string[],
) {
  // Use export * to re-export all from each file
  // This helps with circular dependency resolution in some cases
  sourceFile.addExportDeclarations(
    inputTypeNames
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>(inputTypeName => ({
        moduleSpecifier: `./${inputTypeName}`,
      })),
  );
}

export function generateOutputsBarrelFile(
  sourceFile: SourceFile,
  outputTypeNames: string[],
  hasSomeArgs: boolean,
) {
  sourceFile.addExportDeclarations(
    outputTypeNames
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>(outputTypeName => ({
        moduleSpecifier: `./${outputTypeName}`,
        namedExports: [outputTypeName],
      })),
  );
  if (hasSomeArgs) {
    sourceFile.addExportDeclaration({ moduleSpecifier: `./${argsFolderName}` });
  }
}

export function generateIndexFile(
  sourceFile: SourceFile,
  hasSomeRelations: boolean,
  blocksToEmit: EmitBlockKind[],
) {
  if (blocksToEmit.includes("enums")) {
    sourceFile.addExportDeclaration({
      moduleSpecifier: `./${enumsFolderName}`,
    });
  }
  if (blocksToEmit.includes("models")) {
    sourceFile.addExportDeclaration({
      moduleSpecifier: `./${modelsFolderName}`,
    });
  }
  if (blocksToEmit.includes("crudResolvers")) {
    sourceFile.addExportDeclaration({
      moduleSpecifier: `./${resolversFolderName}/${crudResolversFolderName}`,
    });
    sourceFile.addImportDeclaration({
      moduleSpecifier: `./${resolversFolderName}/${crudResolversFolderName}/resolvers-crud.index`,
      namespaceImport: "crudResolversImport",
    });
    sourceFile.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: "crudResolvers",
          initializer: `Object.values(crudResolversImport) as Function[]`,
        },
      ],
    });
  }
  if (hasSomeRelations && blocksToEmit.includes("relationResolvers")) {
    sourceFile.addExportDeclaration({
      moduleSpecifier: `./${resolversFolderName}/${relationsResolversFolderName}`,
    });
    sourceFile.addImportDeclaration({
      moduleSpecifier: `./${resolversFolderName}/${relationsResolversFolderName}/resolvers.index`,
      namespaceImport: "relationResolversImport",
    });
    sourceFile.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: "relationResolvers",
          initializer: `Object.values(relationResolversImport) as Function[]`,
        },
      ],
    });
  }
  if (blocksToEmit.includes("inputs")) {
    sourceFile.addExportDeclaration({
      moduleSpecifier: `./${resolversFolderName}/${inputsFolderName}`,
    });
  }
  if (blocksToEmit.includes("outputs")) {
    sourceFile.addExportDeclaration({
      moduleSpecifier: `./${resolversFolderName}/${outputsFolderName}`,
    });
  }

  sourceFile.addExportDeclarations([
    { moduleSpecifier: `./enhance` },
    { moduleSpecifier: `./scalars` },
  ]);

  if (
    blocksToEmit.includes("crudResolvers") ||
    (hasSomeRelations && blocksToEmit.includes("relationResolvers"))
  )
    sourceFile.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: "resolvers",
          initializer: `[
            ${blocksToEmit.includes("crudResolvers") ? "...crudResolvers," : ""}
            ${
              hasSomeRelations && blocksToEmit.includes("relationResolvers")
                ? "...relationResolvers,"
                : ""
            }
            ] as Function[]`,
        },
      ],
    });
}

export function generateResolversBarrelFile(
  sourceFile: SourceFile,
  resolversData: GenerateMappingData[],
) {
  resolversData
    .sort((a, b) =>
      a.modelName > b.modelName ? 1 : a.modelName < b.modelName ? -1 : 0,
    )
    .forEach(({ modelName, resolverName }) => {
      sourceFile.addExportDeclaration({
        moduleSpecifier: `./${modelName}/${resolverName}`,
        namedExports: [resolverName],
      });
    });
}
export function generateResolversActionsBarrelFile(
  sourceFile: SourceFile,
  resolversData: GenerateMappingData[],
) {
  resolversData
    .sort((a, b) =>
      a.modelName > b.modelName ? 1 : a.modelName < b.modelName ? -1 : 0,
    )
    .forEach(({ modelName, actionResolverNames }) => {
      if (actionResolverNames) {
        actionResolverNames.forEach(actionResolverName => {
          sourceFile.addExportDeclaration({
            moduleSpecifier: `./${modelName}/${actionResolverName}`,
            namedExports: [actionResolverName],
          });
        });
      }
    });
}

export function generateResolversIndexFile(
  sourceFile: SourceFile,
  type: "crud" | "relations",
  hasSomeArgs: boolean,
) {
  if (type === "crud") {
    sourceFile.addExportDeclarations([
      { moduleSpecifier: `./resolvers-actions.index` },
      { moduleSpecifier: `./resolvers-crud.index` },
    ]);
  } else {
    sourceFile.addExportDeclarations([
      { moduleSpecifier: `./resolvers.index` },
    ]);
  }
  if (hasSomeArgs) {
    sourceFile.addExportDeclarations([{ moduleSpecifier: `./args.index` }]);
  }
}

export const generateModelsImports = createImportGenerator(modelsFolderName);
export const generateEnumsImports = createImportGenerator(enumsFolderName);
export const generateInputsImports = createImportGenerator(
  inputsFolderName,
  true, // Use barrel import for inputs to avoid circular dependency between individual files
  false,
);
export const generateOutputsImports = createImportGenerator(outputsFolderName);
// TODO: unify with generateOutputsImports
export const generateResolversOutputsImports = createImportGenerator(
  `${resolversFolderName}/${outputsFolderName}`,
);
export const generateArgsImports = createImportGenerator(argsFolderName);
function createImportGenerator(
  elementsDirName: string,
  useIndexImport = false,
  isTypeOnly = false,
) {
  return (sourceFile: SourceFile, elementsNames: string[], level = 1) => {
    const distinctElementsNames = [...new Set(elementsNames)].sort();
    if (useIndexImport && distinctElementsNames.length > 0) {
      // Import all from the index file to avoid circular dependency issues
      sourceFile.addImportDeclaration({
        moduleSpecifier:
          (level === 0 ? "./" : "") +
          path.posix.join(...Array(level).fill(".."), elementsDirName),
        namedImports: distinctElementsNames,
        isTypeOnly,
      });
    } else {
      for (const elementName of distinctElementsNames) {
        sourceFile.addImportDeclaration({
          moduleSpecifier:
            (level === 0 ? "./" : "") +
            path.posix.join(
              ...Array(level).fill(".."),
              elementsDirName,
              elementName,
            ),
          // TODO: refactor to default exports
          // defaultImport: elementName,
          namedImports: [elementName],
          isTypeOnly,
        });
      }
    }
  };
}
