import { faker } from "@faker-js/faker";
import type { z } from "zod";

/**
 * Generate mock data from Zod schema using faker
 *
 * Supports common Zod types and generates realistic fake data.
 */
export function generateMockFromSchema<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const def = (schema as any)._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodString":
      return faker.lorem.word() as any;

    case "ZodNumber":
      return faker.number.int({ min: 1, max: 100 }) as any;

    case "ZodBoolean":
      return faker.datatype.boolean() as any;

    case "ZodArray": {
      const itemSchema = def.type;
      const length = faker.number.int({ min: 1, max: 3 });
      return Array.from({ length }, () => generateMockFromSchema(itemSchema)) as any;
    }

    case "ZodObject": {
      const shape = def.shape();
      const result: any = {};
      for (const key in shape) {
        result[key] = generateMockFromSchema(shape[key]);
      }
      return result;
    }

    case "ZodOptional":
      // 50% chance to generate value for optional fields
      return faker.datatype.boolean() ? generateMockFromSchema(def.innerType) : undefined;

    case "ZodNullable":
      // 50% chance to generate value for nullable fields
      return faker.datatype.boolean() ? generateMockFromSchema(def.innerType) : null;

    case "ZodUnion":
      // Pick random option from union
      const options = def.options;
      const randomOption = options[faker.number.int({ min: 0, max: options.length - 1 })];
      return generateMockFromSchema(randomOption);

    case "ZodLiteral":
      return def.value as any;

    case "ZodEnum":
      const values = def.values;
      return values[faker.number.int({ min: 0, max: values.length - 1 })] as any;

    default:
      console.warn(`[generateMock] Unsupported Zod type: ${typeName}, returning null`);
      return null as any;
  }
}
