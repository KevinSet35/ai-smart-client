import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export class SchemaParser {
    /**
     * Convert Zod schema to OpenAI JSON Schema format
     */
    zodToOpenAISchema<T>(zodSchema: z.ZodType<T>): Record<string, any> {
        const jsonSchema = zodToJsonSchema(zodSchema, {
            target: "openApi3",
            $refStrategy: "none",
        });

        // Remove $schema property as OpenAI doesn't accept it
        const { $schema, ...schema } = jsonSchema as any;

        // Clean up the schema to ensure OpenAI compatibility
        this.cleanSchemaForOpenAI(schema);

        return schema;
    }

    /**
     * Recursively clean schema to ensure OpenAI compatibility
     */
    private cleanSchemaForOpenAI(schema: any): void {
        if (typeof schema !== "object" || schema === null) {
            return;
        }

        // Remove unsupported properties
        const unsupportedProps = ["markdownDescription", "errorMessage", "definitions", "$defs"];
        for (const prop of unsupportedProps) {
            delete schema[prop];
        }

        // Fix boolean exclusiveMinimum/exclusiveMaximum (OpenAI expects numbers, not booleans)
        if (typeof schema.exclusiveMinimum === "boolean") {
            if (schema.exclusiveMinimum === true && typeof schema.minimum === "number") {
                schema.exclusiveMinimum = schema.minimum;
                delete schema.minimum;
            } else {
                delete schema.exclusiveMinimum;
            }
        }

        if (typeof schema.exclusiveMaximum === "boolean") {
            if (schema.exclusiveMaximum === true && typeof schema.maximum === "number") {
                schema.exclusiveMaximum = schema.maximum;
                delete schema.maximum;
            } else {
                delete schema.exclusiveMaximum;
            }
        }

        // Handle .positive() - converts to minimum > 0
        if (schema.type === "number" && schema.exclusiveMinimum === 0) {
            delete schema.exclusiveMinimum;
            schema.minimum = 0;
        }

        // Ensure additionalProperties is false for objects (required by OpenAI strict mode)
        if (schema.type === "object") {
            if (!schema.hasOwnProperty("additionalProperties")) {
                schema.additionalProperties = false;
            }
            // Ensure all nested objects also have additionalProperties: false
            if (schema.properties) {
                for (const key in schema.properties) {
                    this.cleanSchemaForOpenAI(schema.properties[key]);
                }
            }
        }

        // Recursively clean nested schemas
        if (schema.items) {
            this.cleanSchemaForOpenAI(schema.items);
        }

        if (schema.anyOf) {
            schema.anyOf.forEach((s: any) => this.cleanSchemaForOpenAI(s));
        }

        if (schema.allOf) {
            schema.allOf.forEach((s: any) => this.cleanSchemaForOpenAI(s));
        }

        if (schema.oneOf) {
            schema.oneOf.forEach((s: any) => this.cleanSchemaForOpenAI(s));
        }
    }
}