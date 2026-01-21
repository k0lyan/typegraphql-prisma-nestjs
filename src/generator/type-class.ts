import path from "path";
import {
  GetAccessorDeclarationStructure,
  MethodDeclarationStructure,
  OptionalKind,
  Project,
  PropertyDeclarationStructure,
  SetAccessorDeclarationStructure,
  SourceFile,
  Writers,
} from "ts-morph";

import { inputsFolderName, outputsFolderName } from "./config";
import { DmmfDocument } from "./dmmf/dmmf-document";
import { DMMF } from "./dmmf/types";
import { pascalCase } from "./helpers";
import {
  generateArgsImports,
  generateCustomScalarsImport,
  generateEnumsImports,
  generateGraphQLScalarsImport,
  generateInputsImports,
  generatePrismaNamespaceImport,
  generateOutputsImports,
  generateModelsImports,
  generateTypeGraphQLImport,
} from "./imports";
import { GeneratorOptions } from "./options";

export function generateOutputTypeClassFromType(
  project: Project,
  dirPath: string,
  type: DMMF.OutputType,
  dmmfDocument: DmmfDocument,
) {
  const fileDirPath = path.resolve(dirPath, outputsFolderName);
  const filePath = path.resolve(fileDirPath, `${type.typeName}.ts`);
  const sourceFile = project.createSourceFile(filePath, undefined, {
    overwrite: true,
  });

  const fieldArgsTypeNames = type.fields
    .filter(it => it.argsTypeName)
    .map(it => it.argsTypeName!);
  const outputObjectTypes = type.fields.filter(
    field => field.outputType.location === "outputObjectTypes",
  );
  const outputObjectModelTypes = outputObjectTypes.filter(field =>
    dmmfDocument.isModelTypeName(field.outputType.type),
  );

  generateTypeGraphQLImport(sourceFile);
  generateGraphQLScalarsImport(sourceFile);
  generatePrismaNamespaceImport(sourceFile, dmmfDocument.options, 2);
  generateCustomScalarsImport(sourceFile, 2);
  generateArgsImports(sourceFile, fieldArgsTypeNames, 0);
  generateOutputsImports(
    sourceFile,
    outputObjectTypes
      .filter(field => !outputObjectModelTypes.includes(field))
      .map(field => field.outputType.type),
    1,
  );
  generateModelsImports(
    sourceFile,
    outputObjectModelTypes.map(field => field.outputType.type),
    2,
  );
  generateEnumsImports(
    sourceFile,
    type.fields
      .map(field => field.outputType)
      .filter(fieldType => fieldType.location === "enumTypes")
      .map(fieldType => fieldType.type),
    2,
  );

  sourceFile.addClass({
    name: type.typeName,
    isExported: true,
    decorators: [
      {
        name: "ObjectType",
        arguments: [
          `"${[dmmfDocument.options.objectTypePrefix, type.typeName]
            .filter(Boolean)
            .join("")}"`,
          Writers.object({
            ...(dmmfDocument.options.emitIsAbstract && {
              isAbstract: "true",
            }),
            ...(dmmfDocument.options.simpleResolvers && {
              simpleResolvers: "true",
            }),
          }),
        ],
      },
    ],
    properties: [
      ...type.fields
        .filter(field => !field.argsTypeName)
        .map<OptionalKind<PropertyDeclarationStructure>>(field => ({
          name: field.name,
          type: field.fieldTSType,
          hasExclamationToken: true,
          hasQuestionToken: false,
          trailingTrivia: "\r\n",
          decorators: [
            {
              name: "Field",
              arguments: [
                `() => ${field.typeGraphQLType}`,
                Writers.object({
                  nullable: `${!field.isRequired}`,
                }),
              ],
            },
          ],
        })),
      ...type.fields
        .filter(field => field.argsTypeName)
        .map<OptionalKind<PropertyDeclarationStructure>>(field => ({
          name: field.name,
          type: field.fieldTSType,
          hasExclamationToken: true,
          hasQuestionToken: false,
        })),
    ],
    methods: type.fields
      .filter(field => field.argsTypeName)
      .map<OptionalKind<MethodDeclarationStructure>>(field => ({
        name: `get${pascalCase(field.name)}`,
        returnType: field.fieldTSType,
        trailingTrivia: "\r\n",
        decorators: [
          {
            name: "Field",
            arguments: [
              `() => ${field.typeGraphQLType}`,
              Writers.object({
                name: `"${field.name}"`,
                nullable: `${!field.isRequired}`,
                // fix for https://github.com/EndyKaufman/typegraphql-prisma-nestjs/issues/49
                ...(field.typeGraphQLType === "Int" &&
                type.typeName.endsWith("Count")
                  ? {
                      middleware: `[
            async (ctx) => {
                return ctx.source.${field.name} || 0;
            },
        ]`,
                    }
                  : {}),
              }),
            ],
          },
        ],
        parameters: [
          {
            name: "root",
            type: type.typeName,
            decorators: [{ name: "Parent", arguments: [] }],
          },
          {
            name: "args",
            type: field.argsTypeName,
            decorators: [{ name: "Args", arguments: [] }],
          },
        ],
        statements: [Writers.returnStatement(`root.${field.name}`)],
      })),
  });
}

export function generateInputTypeClassFromType(
  project: Project,
  dirPath: string,
  inputType: DMMF.InputType,
  options: GeneratorOptions,
) {
  const filePath = path.resolve(
    dirPath,
    inputsFolderName,
    `${inputType.typeName}.ts`,
  );
  const sourceFile = project.createSourceFile(filePath, undefined, {
    overwrite: true,
  });

  generateTypeGraphQLImport(sourceFile);
  generateGraphQLScalarsImport(sourceFile);
  generatePrismaNamespaceImport(sourceFile, options, 2);
  generateCustomScalarsImport(sourceFile, 2);
  generateInputsImports(
    sourceFile,
    inputType.fields
      .filter(f => !options.emitPropertyMethods?.includes(f.name))
      .filter(field => field.selectedInputType.location === "inputObjectTypes")
      .map(field => field.selectedInputType.type)
      .filter(fieldType => fieldType !== inputType.typeName),
  );
  generateEnumsImports(
    sourceFile,
    inputType.fields
      .filter(f => !options.emitPropertyMethods?.includes(f.name))
      .map(field => field.selectedInputType)
      .filter(fieldType => fieldType.location === "enumTypes")
      .map(fieldType => fieldType.type as string),
    2,
  );

  const fieldsToEmit = inputType.fields
    .filter(f => !options.emitPropertyMethods?.includes(f.name))
    .filter(field => !field.isOmitted);
  const mappedFields = fieldsToEmit.filter(field => field.hasMappedName);

  sourceFile.addClass({
    name: inputType.typeName,
    isExported: true,
    decorators: [
      {
        name: "InputType",
        arguments: [
          `"${[options.inputTypePrefix, inputType.typeName]
            .filter(Boolean)
            .join("")}"`,
          Writers.object({
            ...(options.emitIsAbstract && {
              isAbstract: "true",
            }),
          }),
        ],
      },
    ],
    properties: fieldsToEmit.map<OptionalKind<PropertyDeclarationStructure>>(
      field => {
        return {
          name: field.name,
          type: field.fieldTSType,
          hasExclamationToken: !!field.isRequired,
          hasQuestionToken: !field.isRequired,
          trailingTrivia: "\r\n",
          decorators: field.hasMappedName
            ? []
            : [
                {
                  name: "Field",
                  arguments: [
                    `() => ${field.typeGraphQLType}`,
                    Writers.object({
                      nullable: `${!!field.isOptional || !field.isRequired}`,
                    }),
                  ],
                },
              ],
        };
      },
    ),
    getAccessors: mappedFields.map<
      OptionalKind<GetAccessorDeclarationStructure>
    >(field => {
      return {
        name: field.typeName,
        type: field.fieldTSType,
        hasExclamationToken: field.isRequired,
        hasQuestionToken: !field.isRequired,
        trailingTrivia: "\r\n",
        statements: [`return this.${field.name};`],
        decorators: [
          {
            name: "Field",
            arguments: [
              `() => ${field.typeGraphQLType}`,
              Writers.object({
                nullable: `${!field.isRequired}`,
              }),
            ],
          },
        ],
      };
    }),
    setAccessors: mappedFields.map<
      OptionalKind<SetAccessorDeclarationStructure>
    >(field => {
      return {
        name: field.typeName,
        type: field.fieldTSType,
        hasExclamationToken: field.isRequired,
        hasQuestionToken: !field.isRequired,
        trailingTrivia: "\r\n",
        parameters: [{ name: field.name, type: field.fieldTSType }],
        statements: [`this.${field.name} = ${field.name};`],
      };
    }),
  });
}

/**
 * Generate ALL input types in a single file to avoid circular dependency issues.
 * When input types are in separate files and import each other via index.ts,
 * Node.js cannot resolve the circular references at runtime.
 */
export function generateAllInputTypesInSingleFile(
  project: Project,
  dirPath: string,
  inputTypes: readonly DMMF.InputType[],
  options: GeneratorOptions,
): string[] {
  const fileDirPath = path.resolve(dirPath, inputsFolderName);
  const filePath = path.resolve(fileDirPath, "index.ts");
  const sourceFile = project.createSourceFile(filePath, undefined, {
    overwrite: true,
  });

  // Collect all enum types used across all input types
  const allEnumTypeNames = new Set<string>();
  for (const inputType of inputTypes) {
    for (const field of inputType.fields) {
      if (field.selectedInputType.location === "enumTypes") {
        allEnumTypeNames.add(field.selectedInputType.type as string);
      }
    }
  }

  // Generate common imports once at the top
  generateTypeGraphQLImport(sourceFile);
  generateGraphQLScalarsImport(sourceFile);
  generatePrismaNamespaceImport(sourceFile, options, 1);
  generateCustomScalarsImport(sourceFile, 1);
  if (allEnumTypeNames.size > 0) {
    generateEnumsImports(sourceFile, [...allEnumTypeNames], 1);
  }

  // Generate all input type classes in this single file
  for (const inputType of inputTypes) {
    const fieldsToEmit = inputType.fields
      .filter(f => !options.emitPropertyMethods?.includes(f.name))
      .filter(field => !field.isOmitted);
    const mappedFields = fieldsToEmit.filter(field => field.hasMappedName);

    sourceFile.addClass({
      name: inputType.typeName,
      isExported: true,
      decorators: [
        {
          name: "InputType",
          arguments: [
            `"${[options.inputTypePrefix, inputType.typeName]
              .filter(Boolean)
              .join("")}"`,
            Writers.object({
              ...(options.emitIsAbstract && {
                isAbstract: "true",
              }),
            }),
          ],
        },
      ],
      properties: fieldsToEmit.map<OptionalKind<PropertyDeclarationStructure>>(
        field => {
          return {
            name: field.name,
            type: field.fieldTSType,
            hasExclamationToken: !!field.isRequired,
            hasQuestionToken: !field.isRequired,
            trailingTrivia: "\r\n",
            decorators: field.hasMappedName
              ? []
              : [
                  {
                    name: "Field",
                    arguments: [
                      `() => ${field.typeGraphQLType}`,
                      Writers.object({
                        nullable: `${!!field.isOptional || !field.isRequired}`,
                      }),
                    ],
                  },
                ],
          };
        },
      ),
      getAccessors: mappedFields.map<
        OptionalKind<GetAccessorDeclarationStructure>
      >(field => {
        return {
          name: field.typeName,
          type: field.fieldTSType,
          hasExclamationToken: field.isRequired,
          hasQuestionToken: !field.isRequired,
          trailingTrivia: "\r\n",
          statements: [`return this.${field.name};`],
          decorators: [
            {
              name: "Field",
              arguments: [
                `() => ${field.typeGraphQLType}`,
                Writers.object({
                  nullable: `${!!field.isOptional || !field.isRequired}`,
                }),
              ],
            },
          ],
        };
      }),
      setAccessors: mappedFields.map<
        OptionalKind<SetAccessorDeclarationStructure>
      >(field => {
        return {
          name: field.typeName,
          type: field.fieldTSType,
          hasExclamationToken: field.isRequired,
          hasQuestionToken: !field.isRequired,
          trailingTrivia: "\r\n",
          parameters: [{ name: field.name, type: field.fieldTSType }],
          statements: [`this.${field.name} = ${field.name};`],
        };
      }),
    });
  }

  // Return array of type names for reference
  return inputTypes.map(type => type.typeName);
}
