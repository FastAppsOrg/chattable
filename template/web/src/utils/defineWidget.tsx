import type { ComponentType, FC } from "react";
import type { z } from "zod";
import { generateMockFromSchema } from "./generateMockFromSchema";

/**
 * Widget Definition Options
 */
export interface WidgetDefinition<TSchema extends z.ZodTypeAny> {
  /**
   * Zod schema for widget output
   */
  schema: TSchema;

  /**
   * Example output data (optional)
   * If omitted, will be auto-generated from schema using faker
   */
  exampleOutput?: z.infer<TSchema> | (() => z.infer<TSchema>);

  /**
   * Widget component
   * Can be a function component or a render function
   */
  component: ComponentType<any> | FC<any>;
}

/**
 * Widget Metadata (attached to component)
 */
export interface WidgetMetadata<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  schema: TSchema;
  exampleOutput: z.infer<TSchema>;
}

/**
 * Define a widget with type-safe output schema
 *
 * @example Basic usage with explicit example
 * ```tsx
 * export default defineWidget({
 *   schema: PokemonSchema,
 *   exampleOutput: { id: 25, name: "pikachu", ... },
 *   component: () => {
 *     const pokemon = useToolOutput<Pokemon>();
 *     return <div>{pokemon.name}</div>;
 *   }
 * });
 * ```
 *
 * @example With auto-generated mock data
 * ```tsx
 * export default defineWidget({
 *   schema: UserSchema,
 *   // exampleOutput omitted - will use faker
 *   component: () => <div>...</div>
 * });
 * ```
 *
 * @example With function-based example
 * ```tsx
 * export default defineWidget({
 *   schema: PokemonSchema,
 *   exampleOutput: () => ({
 *     id: Math.floor(Math.random() * 150),
 *     name: "random-pokemon"
 *   }),
 *   component: () => <div>...</div>
 * });
 * ```
 */
export function defineWidget<TSchema extends z.ZodTypeAny>(
  definition: WidgetDefinition<TSchema>
): ComponentType<any> & { __widgetMeta: WidgetMetadata<TSchema> } {
  const { schema, exampleOutput, component } = definition;

  // Resolve example output
  let resolvedExample: z.infer<TSchema>;

  if (exampleOutput !== undefined) {
    // Use provided example (function or value)
    if (typeof exampleOutput === "function") {
      resolvedExample = (exampleOutput as () => z.infer<TSchema>)();
    } else {
      resolvedExample = exampleOutput;
    }
  } else {
    // Auto-generate from schema using faker
    resolvedExample = generateMockFromSchema(schema);
  }

  // Create component wrapper
  const Component = component as any;

  // Attach metadata
  Component.__widgetMeta = {
    schema,
    exampleOutput: resolvedExample,
  };

  return Component;
}
