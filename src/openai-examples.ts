import "dotenv/config"; // THIS MUST BE FIRST!
import { z } from "zod";
import { OpenAIClientService } from "./openai-client/openai-client.service";
import { OpenAIClientConfig } from "./openai-client/types/config.types";
import { OpenAIModel } from "./openai-client/config/model-registry";
import { PromptInput, PromptResponse, PromptResponseStatus } from "./openai-client/types/prompt.types";

/**
 * Example usage class demonstrating various features of OpenAIClientService
 */
export class OpenAIClientExamples {
    private client: OpenAIClientService;

    constructor() {
        const config: OpenAIClientConfig = {
            apiKey: process.env.OPENAI_API_KEY,
            defaultModel: OpenAIModel.GPT_4O_MINI,
            defaultTemperature: 0.7,
            systemMessage: "You are a helpful AI assistant.",
            maxTokens: 1000,
            rateLimit: {
                requestsPerMinute: 60,
                tokensPerMinute: 90000,
            },
            requestDelay: 1000, // 1 second between requests
            useJitter: true,
            jitterFactor: 0.3,
        };

        // Log the configuration (hide API key for security)
        console.log("\n=== OpenAI Client Configuration ===");
        console.log(JSON.stringify({
            ...config,
            apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : undefined
        }, null, 2));
        console.log("=====================================\n");

        // Initialize the client with configuration
        this.client = new OpenAIClientService(config);
    }

    /**
     * Helper to extract schema structure for logging
     */
    private getSchemaStructure(schema: z.ZodType<any>): any {
        try {
            // Use Zod's shape if it's an object schema
            if (schema instanceof z.ZodObject) {
                const shape = schema.shape;
                const structure: any = {};

                for (const key in shape) {
                    structure[key] = this.getZodTypeDescription(shape[key]);
                }

                return structure;
            }

            return this.getZodTypeDescription(schema);
        } catch (error) {
            return "Schema structure unavailable";
        }
    }

    /**
     * Get a readable description of a Zod type
     */
    private getZodTypeDescription(zodType: z.ZodType<any>): string {
        if (zodType instanceof z.ZodString) return "string";
        if (zodType instanceof z.ZodNumber) return "number";
        if (zodType instanceof z.ZodBoolean) return "boolean";
        if (zodType instanceof z.ZodArray) {
            const elementType = this.getZodTypeDescription(zodType.element);
            return `array<${elementType}>`;
        }
        if (zodType instanceof z.ZodObject) {
            const shape = zodType.shape;
            const structure: any = {};
            for (const key in shape) {
                structure[key] = this.getZodTypeDescription(shape[key]);
            }
            return structure;
        }
        if (zodType instanceof z.ZodEnum) {
            return `enum[${zodType.options.join(", ")}]`;
        }
        return "unknown";
    }

    /**
     * Helper method to log input and output
     */
    private logPromptDetails<TInput, TOutput>(
        exampleName: string,
        input: PromptInput<TInput, TOutput>,
        response: PromptResponse<TInput, TOutput>,
        schema?: z.ZodType<any>
    ): void {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`${exampleName}`);
        console.log("=".repeat(80));

        // Log Input
        console.log("\n📥 INPUT:");
        const inputLog: any = {
            input: input.input,
            model: input.model,
            temperature: input.temperature,
            systemMessage: input.systemMessage,
            maxTokens: input.maxTokens,
            tools: input.tools ? `${input.tools.length} tool(s)` : undefined,
            toolChoice: input.toolChoice,
            images: input.images ? `${input.images.length} image(s)` : undefined,
            messages: input.messages ? `${input.messages.length} message(s)` : undefined,
        };

        // Add schema structure if provided
        if (schema) {
            inputLog.outputSchema = this.getSchemaStructure(schema);
        } else if (input.outputSchema) {
            inputLog.outputSchema = "Schema provided (structure unavailable)";
        }

        console.log(JSON.stringify(inputLog, null, 2));

        // Log Output
        console.log("\n📤 OUTPUT:");
        console.log(JSON.stringify({
            status: response.status,
            error: response.error,
            content: response.content,
            structuredOutput: response.structuredOutput,
            toolCalls: response.toolCalls ? `${response.toolCalls.length} call(s)` : undefined,
            usage: response.usage,
            model: response.model,
            finishReason: response.finishReason,
        }, null, 2));

        // Add status indicator
        if (response.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ SUCCESS");
        } else {
            console.log(`\n❌ ERROR: ${response.status}`);
            if (response.error) {
                console.log(`   Message: ${response.error}`);
            }
        }

        console.log(`\n${"=".repeat(80)}\n`);
    }

    // ==================== Basic Text Completion ====================

    /**
     * Example 1: Simple text completion
     */
    async simpleTextCompletion() {
        const input: PromptInput<string, string> = {
            input: "What is the capital of France?",
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 1: Simple Text Completion", input, response);
    }

    /**
     * Example 2: Text completion with custom temperature
     */
    async textCompletionWithCustomTemperature() {
        const input: PromptInput<string, string> = {
            input: "Write a creative story about a robot learning to paint.",
            temperature: 1.2,
            maxTokens: 500,
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 2: Text Completion with Custom Temperature", input, response);
    }

    // ==================== Structured Output with Zod Schemas ====================

    /**
     * Example 3: Extract structured data from text
     */
    async extractPersonInformation() {
        // Define the schema
        const PersonSchema = z.object({
            name: z.string(),
            age: z.number(),
            email: z.string().email(),
            occupation: z.string(),
        });

        type Person = z.infer<typeof PersonSchema>;

        const input: PromptInput<string, Person> = {
            input: "Extract information: John Doe is 25 years old. He works as a software engineer and his email is john@example.com",
            outputSchema: PersonSchema,
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 3: Extract Person Information", input, response, PersonSchema);
    }

    /**
     * Example 4: Generate structured product data
     */
    async generateProductData() {
        const ProductSchema = z.object({
            name: z.string(),
            price: z.number().positive(),
            inStock: z.boolean(),
            categories: z.array(z.string()),
            metadata: z.object({
                brand: z.string(),
                sku: z.string(),
                weight: z.number(),
            }),
        });

        type Product = z.infer<typeof ProductSchema>;

        const input: PromptInput<string, Product> = {
            input: "Generate a product listing for a premium wireless headphone",
            outputSchema: ProductSchema,
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 4: Generate Product Data", input, response, ProductSchema);
    }

    /**
     * Example 5: Extract multiple items (array)
     */
    async extractMultipleItems() {
        const TaskSchema = z.object({
            id: z.string(),
            title: z.string(),
            priority: z.enum(["low", "medium", "high"]),
            dueDate: z.string(),
            assignee: z.string(),
        });

        const TaskListSchema = z.object({
            tasks: z.array(TaskSchema),
            totalCount: z.number(),
        });

        type TaskList = z.infer<typeof TaskListSchema>;

        const input: PromptInput<string, TaskList> = {
            input: "Generate 5 tasks for a software development sprint focusing on authentication features",
            outputSchema: TaskListSchema,
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 5: Extract Multiple Items", input, response, TaskListSchema);
    }

    // ==================== Streaming Responses ====================

    /**
     * Example 6: Streaming text generation
     */
    async streamingTextGeneration() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 6: Streaming Text Generation");
        console.log("=".repeat(80));

        const input: PromptInput<string, string> = {
            input: "Write a short story about a time traveler",
            maxTokens: 300,
        };

        console.log("\n📥 INPUT:");
        console.log(JSON.stringify({
            input: input.input,
            maxTokens: input.maxTokens,
        }, null, 2));

        console.log("\n📤 OUTPUT (Streaming):");
        console.log("-".repeat(80));

        const response = await this.client.promptStream(input, (chunk) => {
            process.stdout.write(chunk);
        });

        console.log("\n" + "-".repeat(80));

        if (response.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ SUCCESS");
            console.log("   Finish reason:", response.finishReason);
            console.log("   Model:", response.model);
        } else {
            console.log(`\n❌ ERROR: ${response.status}`);
            if (response.error) {
                console.log(`   Message: ${response.error}`);
            }
        }

        console.log("=".repeat(80) + "\n");
    }

    /**
     * Example 7: Streaming with structured output
     */
    async streamingStructuredOutput() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 7: Streaming with Structured Output");
        console.log("=".repeat(80));

        const RecipeSchema = z.object({
            name: z.string(),
            ingredients: z.array(z.string()),
            instructions: z.array(z.string()),
            prepTime: z.number(),
            servings: z.number(),
        });

        type Recipe = z.infer<typeof RecipeSchema>;

        const input: PromptInput<string, Recipe> = {
            input: "Generate a recipe for chocolate chip cookies",
            outputSchema: RecipeSchema,
        };

        console.log("\n📥 INPUT:");
        console.log(JSON.stringify({
            input: input.input,
            outputSchema: this.getSchemaStructure(RecipeSchema),
        }, null, 2));

        console.log("\n📤 OUTPUT (Streaming):");
        console.log("-".repeat(80));

        let accumulatedText = "";
        const response = await this.client.promptStream(input, (chunk) => {
            accumulatedText += chunk;
            process.stdout.write(chunk);
        });

        console.log("\n" + "-".repeat(80));

        if (response.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ SUCCESS - Validated Recipe:");
            console.log(JSON.stringify(response.structuredOutput, null, 2));
        } else {
            console.log(`\n❌ ERROR: ${response.status}`);
            if (response.error) {
                console.log(`   Message: ${response.error}`);
            }
        }

        console.log("=".repeat(80) + "\n");
    }

    // ==================== Vision (Images) ====================

    /**
     * Example 8: Analyze image
     */
    async analyzeImage() {
        const input: PromptInput<string, string> = {
            input: "What's in this image? Describe it in detail.",
            model: OpenAIModel.GPT_4O,
            images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"],
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 8: Analyze Image", input, response);
    }

    /**
     * Example 9: Extract structured data from image
     */
    async extractDataFromImage() {
        const DiceAnalysisSchema = z.object({
            totalDice: z.number(),
            dice: z.array(
                z.object({
                    color: z.string(),
                    value: z.number().min(1).max(6),
                    position: z.string(), // e.g., "left", "center", "right"
                })
            ),
            totalValue: z.number(),
            colors: z.array(z.string()),
        });

        type DiceAnalysis = z.infer<typeof DiceAnalysisSchema>;

        const input: PromptInput<string, DiceAnalysis> = {
            input: "Analyze this image of dice. For each die, identify its color, the number showing on top, and its position in the image. Also provide the total count and sum of all dice values.",
            model: OpenAIModel.GPT_4O,
            images: ["https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png"],
            outputSchema: DiceAnalysisSchema,
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 9: Extract Structured Data from Image (Dice)", input, response, DiceAnalysisSchema);
    }

    // ==================== Conversation History ====================

    /**
     * Example 10: Multi-turn conversation
     */
    async multiTurnConversation() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 10: Multi-turn Conversation");
        console.log("=".repeat(80));

        // First message
        const input1: PromptInput<string, string> = {
            input: "My name is Alice and I love programming.",
        };

        console.log("\n📥 INPUT (Turn 1):");
        console.log(JSON.stringify({ input: input1.input }, null, 2));

        const response1 = await this.client.prompt(input1);

        console.log("\n📤 OUTPUT (Turn 1):");
        console.log(JSON.stringify({
            status: response1.status,
            content: response1.content,
            usage: response1.usage,
        }, null, 2));

        if (response1.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ Turn 1 SUCCESS");
        } else {
            console.log(`\n❌ Turn 1 ERROR: ${response1.status}`);
            if (response1.error) {
                console.log(`   Message: ${response1.error}`);
            }
        }

        // Second message with history
        const input2: PromptInput<string, string> = {
            input: "What's my name and what do I love?",
            messages: [
                { role: "user", content: "My name is Alice and I love programming." },
                { role: "assistant", content: response1.content as string },
            ],
        };

        console.log("\n📥 INPUT (Turn 2):");
        console.log(JSON.stringify({
            input: input2.input,
            messages: `${input2.messages?.length} previous messages`,
        }, null, 2));

        const response2 = await this.client.prompt(input2);

        console.log("\n📤 OUTPUT (Turn 2):");
        console.log(JSON.stringify({
            status: response2.status,
            content: response2.content,
            usage: response2.usage,
        }, null, 2));

        if (response2.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ Turn 2 SUCCESS - Multi-turn conversation complete");
        } else {
            console.log(`\n❌ Turn 2 ERROR: ${response2.status}`);
            if (response2.error) {
                console.log(`   Message: ${response2.error}`);
            }
        }

        console.log("=".repeat(80) + "\n");
    }

    // ==================== Error Handling ====================

    /**
     * Example 11: Handle validation errors
     */
    async handleValidationError() {
        const StrictSchema = z.object({
            count: z.number().int().positive(),
            status: z.enum(["active", "inactive"]),
            email: z.string().email(),
        });

        type StrictData = z.infer<typeof StrictSchema>;

        const input: PromptInput<string, StrictData> = {
            input: "Generate some random data",
            outputSchema: StrictSchema,
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 11: Handle Validation Error", input, response, StrictSchema);
    }

    /**
     * Example 12: Handle different error types
     */
    async handleDifferentErrors() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 12: Handle Different Error Types");
        console.log("=".repeat(80));

        const inputs = ["Test 1", "Test 2", "Test 3"];

        const responses = await Promise.all(
            inputs.map((input) => this.client.prompt<string, string>({ input }))
        );

        responses.forEach((response, index) => {
            console.log(`\n📊 Response ${index + 1}:`);
            console.log(JSON.stringify({
                status: response.status,
                error: response.error,
                content: response.content,
                usage: response.usage,
            }, null, 2));

            if (response.status === PromptResponseStatus.SUCCESS) {
                console.log("✅ Success");
            } else {
                console.log(`❌ Error: ${response.status}`);
            }
        });

        console.log("\n" + "=".repeat(80) + "\n");
    }

    // ==================== Advanced Usage ====================

    /**
     * Example 13: Custom system message per request
     */
    async customSystemMessage() {
        const input: PromptInput<string, string> = {
            input: "Explain quantum computing",
            systemMessage: "You are a physics professor explaining concepts to undergraduate students. Use simple analogies.",
            temperature: 0.5,
        };

        const response = await this.client.prompt(input);
        this.logPromptDetails("Example 13: Custom System Message", input, response);
    }

    /**
     * Example 14: Different models for different tasks
     */
    async useMultipleModels() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 14: Use Multiple Models");
        console.log("=".repeat(80));

        // Fast model for simple tasks
        const fastInput: PromptInput<string, string> = {
            input: "What is 2+2?",
            model: OpenAIModel.GPT_4O_MINI,
        };

        const fastResponse = await this.client.prompt(fastInput);
        console.log("\n⚡ Fast Model (GPT-4O-MINI):");
        console.log(JSON.stringify({
            status: fastResponse.status,
            input: fastInput.input,
            output: fastResponse.content,
            usage: fastResponse.usage,
        }, null, 2));

        if (fastResponse.status === PromptResponseStatus.SUCCESS) {
            console.log("✅ Fast model success");
        } else {
            console.log(`❌ Fast model error: ${fastResponse.status}`);
        }

        // Powerful model for complex tasks
        const complexInput: PromptInput<string, string> = {
            input: "Explain the philosophical implications of artificial consciousness",
            model: OpenAIModel.GPT_4O,
            maxTokens: 500,
        };

        const complexResponse = await this.client.prompt(complexInput);
        console.log("\n🧠 Complex Model (GPT-4O):");
        console.log(JSON.stringify({
            status: complexResponse.status,
            input: complexInput.input,
            output: complexResponse.content,
            usage: complexResponse.usage,
        }, null, 2));

        if (complexResponse.status === PromptResponseStatus.SUCCESS) {
            console.log("✅ Complex model success");
        } else {
            console.log(`❌ Complex model error: ${complexResponse.status}`);
        }

        console.log("\n" + "=".repeat(80) + "\n");
    }

    /**
     * Example 15: Batch processing with rate limiting
     */
    async batchProcessing() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 15: Batch Processing with Rate Limiting");
        console.log("=".repeat(80));

        const inputs = [
            "Translate 'Hello' to Spanish",
            "Translate 'Goodbye' to French",
            "Translate 'Thank you' to German",
            "Translate 'Please' to Italian",
            "Translate 'Sorry' to Japanese",
        ];

        console.log(`\n📦 Processing batch of ${inputs.length} requests...\n`);

        const responses = await Promise.all(
            inputs.map((input) =>
                this.client.prompt<string, string>({
                    input,
                    maxTokens: 50,
                })
            )
        );

        responses.forEach((response, index) => {
            console.log(`\n${index + 1}. ${inputs[index]}`);
            console.log(`   Status: ${response.status}`);
            if (response.status === PromptResponseStatus.SUCCESS) {
                console.log(`   ✅ ${response.content}`);
                console.log(`   Tokens: ${response.usage?.totalTokens}`);
            } else {
                console.log(`   ❌ Error: ${response.error}`);
            }
        });

        console.log("\n" + "=".repeat(80) + "\n");
    }

    // ==================== Run All Examples ====================

    /**
     * Add visual separation between examples
     */
    private addSeparation(): void {
        console.log("\n\x1b[36m" + "═".repeat(80) + "\x1b[0m\n"); // Cyan color
    }

    /**
     * Run all examples
     */
    async runAllExamples() {
        try {
            console.log("\n\n" + "╔".repeat(80));
            console.log("🚀 STARTING ALL EXAMPLES");
            console.log("╚".repeat(80) + "\n\n");

            await this.simpleTextCompletion();
            this.addSeparation();

            await this.textCompletionWithCustomTemperature();
            this.addSeparation();

            await this.extractPersonInformation();
            this.addSeparation();

            await this.generateProductData();
            this.addSeparation();

            await this.extractMultipleItems();
            this.addSeparation();

            await this.streamingTextGeneration();
            this.addSeparation();

            await this.streamingStructuredOutput();
            this.addSeparation();

            await this.analyzeImage();
            this.addSeparation();

            await this.extractDataFromImage();
            this.addSeparation();

            await this.multiTurnConversation();
            this.addSeparation();

            await this.handleValidationError();
            this.addSeparation();

            await this.customSystemMessage();
            this.addSeparation();

            await this.useMultipleModels();
            this.addSeparation();

            await this.batchProcessing();

            console.log("\n\n" + "╔".repeat(80));
            console.log("✅ ALL EXAMPLES COMPLETED SUCCESSFULLY");
            console.log("╚".repeat(80) + "\n\n");
        } catch (error) {
            console.error("\n\n" + "╔".repeat(80));
            console.error("❌ FATAL ERROR");
            console.error("╚".repeat(80));
            console.error(error);
            console.error("\n\n");
        }
    }
}

// ==================== Usage ====================

// Run examples
const examples = new OpenAIClientExamples();

// Run a specific example
// examples.simpleTextCompletion();
// examples.extractPersonInformation();

// Or run all examples
examples.runAllExamples();