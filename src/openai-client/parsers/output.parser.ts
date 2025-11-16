import { Logger } from "@nestjs/common";
import { z } from "zod";

export class OutputParser {
    private readonly logger = new Logger(OutputParser.name);

    /**
     * Parse and validate output against schema
     */
    parseAndValidateOutput<TOutput>(
        rawContent: string,
        outputSchema: z.ZodType<TOutput> | undefined
    ): { content: TOutput; structuredOutput?: TOutput } {
        if (!outputSchema || !rawContent) {
            return { content: rawContent as TOutput };
        }

        try {
            const parsed = JSON.parse(rawContent);
            const validated = outputSchema.parse(parsed);

            this.logger.debug("Successfully validated output against Zod schema");
            return { content: validated, structuredOutput: validated };
        } catch (error) {
            if (error instanceof z.ZodError) {
                this.logger.error("Output validation failed:", error.errors);
                throw new Error(
                    `OpenAI response does not match expected schema: ${error.errors
                        .map((e) => `${e.path.join(".")}: ${e.message}`)
                        .join(", ")}`
                );
            }

            this.logger.warn("Failed to parse structured output, returning raw content", error);
            return { content: rawContent as TOutput };
        }
    }
}