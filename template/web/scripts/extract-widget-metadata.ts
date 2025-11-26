#!/usr/bin/env tsx
/**
 * Extract Widget Metadata Script
 *
 * Simple approach: Just read source code and extract example data from shared package.
 * No compilation needed!
 */

import { glob } from "glob";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { faker } from "@faker-js/faker";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WidgetMetadata {
  name: string;
  exampleOutput: unknown;
}

/**
 * Generate example data from Zod schema using faker
 */
function generateExampleFromZodSchema(schema: z.ZodTypeAny): unknown {
  const typeName = schema._def?.typeName;

  if (typeName === 'ZodObject' || schema instanceof z.ZodObject) {
    const shape = (schema as any).shape;
    const example: Record<string, unknown> = {};

    for (const [key, fieldSchema] of Object.entries(shape)) {
      example[key] = generateExampleFromZodSchema(fieldSchema as z.ZodTypeAny);
    }

    return example;
  }

  if (typeName === 'ZodString' || schema instanceof z.ZodString) {
    return faker.lorem.word();
  }

  if (typeName === 'ZodNumber' || schema instanceof z.ZodNumber) {
    return faker.number.int({ min: 1, max: 100 });
  }

  if (typeName === 'ZodBoolean' || schema instanceof z.ZodBoolean) {
    return faker.datatype.boolean();
  }

  if (typeName === 'ZodArray' || schema instanceof z.ZodArray) {
    const element = (schema as any).element;
    const count = faker.number.int({ min: 2, max: 3 });
    return Array.from({ length: count }, () => generateExampleFromZodSchema(element));
  }

  if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
    return generateExampleFromZodSchema((schema as any).unwrap());
  }

  if (typeName === 'ZodDefault') {
    return schema._def.defaultValue();
  }

  if (typeName === 'ZodEnum') {
    const values = schema._def.values;
    return faker.helpers.arrayElement(values);
  }

  if (typeName === 'ZodUnion') {
    const options = schema._def.options;
    return generateExampleFromZodSchema(faker.helpers.arrayElement(options));
  }

  // Fallback
  return null;
}

async function main() {
  console.log("[extract-metadata] Extracting widget metadata...");

  const webRoot = path.resolve(__dirname, "..");
  const widgetFiles = await glob("src/widgets/*.tsx", {
    cwd: webRoot,
    absolute: false,
  });

  if (widgetFiles.length === 0) {
    console.warn("[extract-metadata] No *.tsx files found in src/widgets/");
    return;
  }

  const metadataMap: Record<string, WidgetMetadata> = {};

  // Import shared package
  const shared = await import("@apps-sdk-template/shared");

  for (const widgetFile of widgetFiles) {
    try {
      const widgetName = path.basename(widgetFile, ".tsx");
      const content = await fs.readFile(path.join(webRoot, widgetFile), "utf-8");

      // Check if file uses defineWidget
      if (!content.includes("defineWidget")) {
        console.log(`[extract-metadata] ⊘ Skipping ${widgetName} (no defineWidget usage)`);
        continue;
      }

      // Parse exampleOutput from defineWidget call (skip commented lines)
      // Match: exampleOutput: examplePokemonData (but not // exampleOutput:)
      const lines = content.split('\n');
      let exampleName: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) continue; // Skip comment lines
        const match = trimmed.match(/exampleOutput:\s*(\w+)/);
        if (match) {
          exampleName = match[1];
          break;
        }
      }

      let exampleOutput: unknown = null;

      if (exampleName) {
        // Get example from shared package
        if (shared[exampleName]) {
          exampleOutput = shared[exampleName];
          console.log(`[extract-metadata] ✓ Extracted metadata for: ${widgetName} (using ${exampleName})`);
        } else {
          console.warn(`[extract-metadata] ⚠ ${widgetName}: ${exampleName} not found in shared package`);
        }
      }

      // If no exampleOutput, try to generate from schema (outputSchema or schema field)
      if (!exampleOutput) {
        let schemaName: string | null = null;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//')) continue; // Skip comment lines
          const match = trimmed.match(/(?:outputSchema|schema):\s*(\w+)/);
          if (match) {
            schemaName = match[1];
            break;
          }
        }

        if (schemaName) {
          if (shared[schemaName]) {
            try {
              exampleOutput = generateExampleFromZodSchema(shared[schemaName]);
              console.log(`[extract-metadata] ✓ Generated metadata for: ${widgetName} (using faker from ${schemaName})`);
            } catch (error) {
              console.error(`[extract-metadata] ✗ Failed to generate from ${schemaName}:`, error);
            }
          } else {
            console.warn(`[extract-metadata] ⚠ ${widgetName}: ${schemaName} not found in shared package`);
          }
        } else {
          console.warn(`[extract-metadata] ⚠ ${widgetName}: No exampleOutput or schema found`);
        }
      }

      if (exampleOutput) {
        metadataMap[widgetName] = {
          name: widgetName,
          exampleOutput,
        };
      }
    } catch (error) {
      console.error(`[extract-metadata] Failed to process ${widgetFile}:`, error);
    }
  }

  // Write widget-metadata.json
  const outputDir = path.resolve(webRoot, "dist");
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "widget-metadata.json");
  await fs.writeFile(outputPath, JSON.stringify(metadataMap, null, 2), "utf-8");

  console.log(`[extract-metadata] ✓ Generated widget-metadata.json with ${Object.keys(metadataMap).length} widgets`);
}

main().catch((error) => {
  console.error("[extract-metadata] Fatal error:", error);
  process.exit(1);
});
