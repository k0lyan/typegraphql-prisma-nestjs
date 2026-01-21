import { crudResolversFolderName, resolversFolderName } from "../config";
import {
  generateArgsImports,
  generateGraphQLInfoImport,
  generateHelpersFileImport,
  generateModelsImports,
  generateOutputsImports,
  generateTypeGraphQLImport,
} from "../imports";

import { DMMF } from "../dmmf/types";
import { DmmfDocument } from "../dmmf/dmmf-document";
import { GeneratorOptions } from "../options";
import { Project } from "ts-morph";
import { generateCrudResolverClassMethodDeclaration } from "./helpers";
import path from "path";

export default function generateActionResolverClass(
  project: Project,
  baseDirPath: string,
  model: DMMF.Model,
  action: DMMF.Action,
  mapping: DMMF.ModelMapping,
  dmmfDocument: DmmfDocument,
  generatorOptions: GeneratorOptions,
) {
  const sourceFile = project.createSourceFile(
    path.resolve(
      baseDirPath,
      resolversFolderName,
      crudResolversFolderName,
      model.typeName,
      `${action.actionResolverName}.ts`,
    ),
    undefined,
    { overwrite: true },
  );

  generateTypeGraphQLImport(sourceFile);
  generateGraphQLInfoImport(sourceFile);
  if (action.argsTypeName) {
    generateArgsImports(sourceFile, [action.argsTypeName], 0);
  }
  generateModelsImports(
    sourceFile,
    [model.typeName, action.outputTypeName].filter(typeName =>
      dmmfDocument.isModelTypeName(typeName),
    ),
    3,
  );
  generateOutputsImports(
    sourceFile,
    [action.outputTypeName].filter(
      typeName => !dmmfDocument.isModelTypeName(typeName),
    ),
    2,
  );
  generateHelpersFileImport(sourceFile, 3);

  sourceFile.addClass({
    name: action.actionResolverName,
    isExported: true,
    decorators: [
      {
        name: "Resolver",
        arguments: [`(_of: any) => ${model.typeName}`],
      },
    ],
    methods: [
      generateCrudResolverClassMethodDeclaration(
        action,
        mapping,
        dmmfDocument,
        generatorOptions,
      ),
    ],
  });
}
