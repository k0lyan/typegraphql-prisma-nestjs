import type { DMMF as PrismaDMMF } from "@prisma/generator-helper";
import { getDMMF } from "@prisma/internals";

export default async function getPrismaClientDmmfFromPrismaSchema(
  prismaSchema: string,
  previewFeatures: string[] = [],
  provider = "postgresql",
): Promise<PrismaDMMF.Document> {
  const previewFeaturesToEmit = [...previewFeatures];
  // Prisma 7 no longer supports `url` in datasource for getDMMF
  // We only need the provider for schema validation
  const datamodelWithGeneratorBlock = /* prisma */ `
    datasource db {
      provider = "${provider}"
    }
    generator client {
      provider = "prisma-client-js"
      ${
        previewFeaturesToEmit.length > 0
          ? `previewFeatures = [${previewFeaturesToEmit
              .map(it => `"${it}"`)
              .join(", ")}]`
          : ""
      }
    }
    ${prismaSchema}
  `;
  return await getDMMF({
    datamodel: datamodelWithGeneratorBlock,
    previewFeatures,
  });
}
