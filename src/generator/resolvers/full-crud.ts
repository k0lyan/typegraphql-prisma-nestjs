import path from "path";
import { MethodDeclarationStructure, OptionalKind, Project } from "ts-morph";

import { crudResolversFolderName, resolversFolderName } from "../config";
import { DmmfDocument } from "../dmmf/dmmf-document";
import { DMMF } from "../dmmf/types";
import {
  generateArgsImports,
  generateGraphQLInfoImport,
  generateHelpersFileImport,
  generateModelsImports,
  generateOutputsImports,
  generateTypeGraphQLImport,
} from "../imports";
import { GeneratorOptions } from "../options";
import { generateCrudResolverClassMethodDeclaration } from "./helpers";

export default function generateCrudResolverClassFromMapping(
  project: Project,
  baseDirPath: string,
  mapping: DMMF.ModelMapping,
  model: DMMF.Model,
  dmmfDocument: DmmfDocument,
  generatorOptions: GeneratorOptions,
) {
  const resolverDirPath = path.resolve(
    baseDirPath,
    resolversFolderName,
    crudResolversFolderName,
    model.typeName,
  );
  const filePath = path.resolve(resolverDirPath, `${mapping.resolverName}.ts`);
  const sourceFile = project.createSourceFile(filePath, undefined, {
    overwrite: true,
  });

  generateTypeGraphQLImport(sourceFile);
  generateGraphQLInfoImport(sourceFile);
  generateArgsImports(
    sourceFile,
    mapping.actions
      .filter(a => !generatorOptions.emitActions?.includes(a.prismaMethod))
      .filter(it => it.argsTypeName !== undefined)
      .map(it => it.argsTypeName!),
    0,
  );
  generateHelpersFileImport(sourceFile, 3);

  const distinctOutputTypesNames = [
    ...new Set(
      mapping.actions
        .filter(a => !generatorOptions.emitActions?.includes(a.prismaMethod))
        .map(it => it.outputTypeName),
    ),
  ];
  const modelOutputTypeNames = distinctOutputTypesNames.filter(typeName =>
    dmmfDocument.isModelTypeName(typeName),
  );
  const otherOutputTypeNames = distinctOutputTypesNames.filter(
    typeName => !dmmfDocument.isModelTypeName(typeName),
  );
  generateModelsImports(sourceFile, modelOutputTypeNames, 3);
  generateOutputsImports(sourceFile, otherOutputTypeNames, 2);

  sourceFile.addClass({
    name: mapping.resolverName,
    isExported: true,
    decorators: [
      {
        name: "Resolver",
        arguments: [`_of => ${model.typeName}`],
      },
    ],
    methods: mapping.actions
      .filter(a => !generatorOptions.emitActions?.includes(a.prismaMethod))
      .map<
        OptionalKind<MethodDeclarationStructure>
      >(action => generateCrudResolverClassMethodDeclaration(action, mapping, dmmfDocument, generatorOptions)),
  });
}
