import "dotenv/config"; // THIS MUST BE FIRST!
import { z } from "zod";
import { OpenAIClientService } from "./openai-client/openai-client.service";
import { OpenAIClientConfig } from "./openai-client/types/config.types";
import { OpenAIModel } from "./openai-client/config/model-registry";
import { PromptInput, PromptResponse, PromptResponseStatus } from "./openai-client/types/prompt.types";
import OpenAI from "openai";

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

    // Add this after the "Advanced Usage" section and before "Run All Examples"

    // ==================== Function Calling (Tools) ====================

    /**
     * Example 16: Basic function calling
     */
    async basicFunctionCalling() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 16: Basic Function Calling");
        console.log("=".repeat(80));

        // Define tools
        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: "get_weather",
                    description: "Get the current weather for a location",
                    parameters: {
                        type: "object",
                        properties: {
                            location: {
                                type: "string",
                                description: "The city and state, e.g. San Francisco, CA",
                            },
                            unit: {
                                type: "string",
                                enum: ["celsius", "fahrenheit"],
                                description: "The temperature unit",
                            },
                        },
                        required: ["location"],
                    },
                },
            },
        ];

        // Implement the function
        const getWeather = (location: string, unit: string = "fahrenheit"): string => {
            const weatherData = {
                location,
                temperature: unit === "celsius" ? 22 : 72,
                unit,
                condition: "sunny",
                humidity: 65,
            };
            return JSON.stringify(weatherData);
        };

        const availableFunctions: Record<string, (...args: any[]) => string> = {
            get_weather: getWeather,
        };

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        // Initial request
        const input: PromptInput<string, string> = {
            input: "What's the weather like in Boston?",
            tools,
            toolChoice: "auto",
            messages,
        };

        console.log("\n📥 INPUT:");
        console.log(JSON.stringify({
            input: input.input,
            tools: `${tools.length} tool(s) defined`,
            toolChoice: input.toolChoice,
        }, null, 2));

        let response = await this.client.prompt(input);

        console.log("\n📤 INITIAL RESPONSE:");
        console.log(JSON.stringify({
            status: response.status,
            toolCalls: response.toolCalls?.map(tc => ({
                function: tc.function.name,
                arguments: tc.function.arguments,
            })),
        }, null, 2));

        // Handle tool calls
        if (response.status === PromptResponseStatus.SUCCESS && response.toolCalls && response.toolCalls.length > 0) {
            console.log("\n🔧 EXECUTING FUNCTIONS:");

            // Add assistant's response to conversation
            messages.push({
                role: "assistant",
                content: response.raw.choices[0].message.content,
                tool_calls: response.toolCalls,
            });

            // Execute each tool call
            for (const toolCall of response.toolCalls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                console.log(`\n  → Calling ${functionName}:`, functionArgs);

                const functionToCall = availableFunctions[functionName];
                const functionResponse = functionToCall(...Object.values(functionArgs));

                console.log(`  ← Result:`, JSON.parse(functionResponse));

                // Add function result to conversation
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: functionResponse,
                });
            }

            // Get final response with function results
            const finalInput: PromptInput<string, string> = {
                input: input.input,
                tools,
                messages,
            };

            const finalResponse = await this.client.prompt(finalInput);

            console.log("\n📤 FINAL RESPONSE:");
            console.log(JSON.stringify({
                status: finalResponse.status,
                content: finalResponse.content,
                usage: finalResponse.usage,
                cost: finalResponse.cost,
            }, null, 2));

            if (finalResponse.status === PromptResponseStatus.SUCCESS) {
                console.log("\n✅ SUCCESS - Function calling completed");
            } else {
                console.log(`\n❌ ERROR: ${finalResponse.status}`);
            }
        } else {
            console.log("\n⚠️  No tool calls made");
        }

        console.log("=".repeat(80) + "\n");
    }

    /**
     * Example 17: Multiple function calls in one request
     */
    async multipleFunctionCalls() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 17: Multiple Function Calls");
        console.log("=".repeat(80));

        // Define multiple tools
        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: "get_weather",
                    description: "Get the current weather for a location",
                    parameters: {
                        type: "object",
                        properties: {
                            location: { type: "string" },
                            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
                        },
                        required: ["location"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "search_database",
                    description: "Search for records in the database",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string" },
                            limit: { type: "number" },
                        },
                        required: ["query"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "get_user_info",
                    description: "Get user information by user ID",
                    parameters: {
                        type: "object",
                        properties: {
                            userId: { type: "string" },
                        },
                        required: ["userId"],
                    },
                },
            },
        ];

        // Implement functions
        const getWeather = (location: string, unit: string = "fahrenheit"): string => {
            return JSON.stringify({
                location,
                temperature: unit === "celsius" ? 22 : 72,
                unit,
                condition: "partly cloudy",
            });
        };

        const searchDatabase = (query: string, limit: number = 10): string => {
            return JSON.stringify({
                results: [
                    { id: 1, title: `Result for: ${query}`, relevance: 0.95 },
                    { id: 2, title: `Another match: ${query}`, relevance: 0.87 },
                ].slice(0, limit),
                total: 2,
            });
        };

        const getUserInfo = (userId: string): string => {
            return JSON.stringify({
                userId,
                name: "Alice Johnson",
                email: "alice@example.com",
                accountType: "premium",
            });
        };

        const availableFunctions: Record<string, (...args: any[]) => string> = {
            get_weather: getWeather,
            search_database: searchDatabase,
            get_user_info: getUserInfo,
        };

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        const input: PromptInput<string, string> = {
            input: "What's the weather in New York? Also search our database for 'quarterly reports' and get info for user 'user123'",
            tools,
            toolChoice: "auto",
            messages,
        };

        console.log("\n📥 INPUT:");
        console.log(JSON.stringify({
            input: input.input,
            tools: tools.map(t => t.function.name),
        }, null, 2));

        let response = await this.client.prompt(input);
        let iterationCount = 0;
        const maxIterations = 3;

        // Handle multiple rounds of function calling
        while (
            response.status === PromptResponseStatus.SUCCESS &&
            response.toolCalls &&
            response.toolCalls.length > 0 &&
            iterationCount < maxIterations
        ) {
            iterationCount++;
            console.log(`\n🔧 FUNCTION CALLING ROUND ${iterationCount}:`);
            console.log(`   Tool calls: ${response.toolCalls.length}`);

            // Add assistant's response to conversation
            messages.push({
                role: "assistant",
                content: response.raw.choices[0].message.content,
                tool_calls: response.toolCalls,
            });

            // Execute each tool call
            for (const toolCall of response.toolCalls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                console.log(`\n  → ${functionName}(${JSON.stringify(functionArgs)})`);

                const functionToCall = availableFunctions[functionName];
                if (!functionToCall) {
                    throw new Error(`Function ${functionName} not found`);
                }

                const functionResponse = functionToCall(...Object.values(functionArgs));
                console.log(`  ← ${functionResponse}`);

                // Add function result to conversation
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: functionResponse,
                });
            }

            // Get next response
            response = await this.client.prompt({
                input: input.input,
                tools,
                messages,
            });
        }

        console.log("\n📤 FINAL RESPONSE:");
        console.log(JSON.stringify({
            status: response.status,
            content: response.content,
            usage: response.usage,
            cost: response.cost,
            totalIterations: iterationCount,
        }, null, 2));

        if (response.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ SUCCESS - Multiple function calls completed");
        } else {
            console.log(`\n❌ ERROR: ${response.status}`);
        }

        console.log("=".repeat(80) + "\n");
    }

    /**
     * Example 18: Function calling with structured output
     */
    async functionCallingWithStructuredOutput() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 18: Function Calling with Structured Output");
        console.log("=".repeat(80));

        // Define schema for final output
        const WeatherReportSchema = z.object({
            location: z.string(),
            currentTemp: z.number(),
            unit: z.string(),
            condition: z.string(),
            summary: z.string(),
        });

        type WeatherReport = z.infer<typeof WeatherReportSchema>;

        // Define tool
        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: "get_weather",
                    description: "Get the current weather for a location",
                    parameters: {
                        type: "object",
                        properties: {
                            location: { type: "string" },
                            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
                        },
                        required: ["location"],
                    },
                },
            },
        ];

        const getWeather = (location: string, unit: string = "fahrenheit"): string => {
            return JSON.stringify({
                location,
                temperature: 75,
                unit,
                condition: "sunny",
                humidity: 60,
            });
        };

        const availableFunctions: Record<string, (...args: any[]) => string> = {
            get_weather: getWeather,
        };

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        const input: PromptInput<string, WeatherReport> = {
            input: "Get the weather for Miami and format it as a report",
            tools,
            toolChoice: "auto",
            outputSchema: WeatherReportSchema,
            messages,
        };

        console.log("\n📥 INPUT:");
        console.log(JSON.stringify({
            input: input.input,
            tools: `${tools.length} tool(s)`,
            outputSchema: this.getSchemaStructure(WeatherReportSchema),
        }, null, 2));

        let response = await this.client.prompt(input);

        // Handle tool calls
        if (response.status === PromptResponseStatus.SUCCESS && response.toolCalls) {
            console.log("\n🔧 EXECUTING FUNCTION:");

            messages.push({
                role: "assistant",
                content: response.raw.choices[0].message.content,
                tool_calls: response.toolCalls,
            });

            for (const toolCall of response.toolCalls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                console.log(`  → ${functionName}:`, functionArgs);

                const functionResponse = availableFunctions[functionName](...Object.values(functionArgs));
                console.log(`  ← ${functionResponse}`);

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: functionResponse,
                });
            }

            // Get final structured response
            response = await this.client.prompt({
                input: input.input,
                tools,
                outputSchema: WeatherReportSchema,
                messages,
            });
        }

        console.log("\n📤 FINAL RESPONSE:");
        console.log(JSON.stringify({
            status: response.status,
            structuredOutput: response.structuredOutput,
            usage: response.usage,
            cost: response.cost,
        }, null, 2));

        if (response.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ SUCCESS - Function call with structured output");
            console.log("\n📋 Validated Output:");
            console.log(JSON.stringify(response.structuredOutput, null, 2));
        } else {
            console.log(`\n❌ ERROR: ${response.status}`);
        }

        console.log("=".repeat(80) + "\n");
    }

    /**
     * Example 19: Force specific function call
     */
    async forceSpecificFunction() {
        console.log("\n" + "=".repeat(80));
        console.log("Example 19: Force Specific Function Call");
        console.log("=".repeat(80));

        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: "calculate_total",
                    description: "Calculate the total cost including tax",
                    parameters: {
                        type: "object",
                        properties: {
                            subtotal: { type: "number" },
                            taxRate: { type: "number" },
                        },
                        required: ["subtotal", "taxRate"],
                    },
                },
            },
            {
                type: "function",
                function: {
                    name: "get_weather",
                    description: "Get weather information",
                    parameters: {
                        type: "object",
                        properties: {
                            location: { type: "string" },
                        },
                        required: ["location"],
                    },
                },
            },
        ];

        const calculateTotal = (subtotal: number, taxRate: number): string => {
            const tax = subtotal * taxRate;
            const total = subtotal + tax;
            return JSON.stringify({ subtotal, tax, total });
        };

        const getWeather = (location: string): string => {
            return JSON.stringify({ location, temp: 72, condition: "sunny" });
        };

        const availableFunctions: Record<string, (...args: any[]) => string> = {
            calculate_total: calculateTotal,
            get_weather: getWeather,
        };

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        // Force calculate_total even though the query might seem ambiguous
        const input: PromptInput<string, string> = {
            input: "My purchase was $100",
            tools,
            toolChoice: {
                type: "function",
                function: { name: "calculate_total" },
            },
            messages,
        };

        console.log("\n📥 INPUT:");
        console.log(JSON.stringify({
            input: input.input,
            toolChoice: "Force calculate_total function",
        }, null, 2));

        let response = await this.client.prompt(input);

        if (response.status === PromptResponseStatus.SUCCESS && response.toolCalls) {
            console.log("\n🔧 FORCED FUNCTION CALL:");

            messages.push({
                role: "assistant",
                content: response.raw.choices[0].message.content,
                tool_calls: response.toolCalls,
            });

            for (const toolCall of response.toolCalls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                console.log(`  → ${functionName}:`, functionArgs);

                const functionResponse = availableFunctions[functionName](...Object.values(functionArgs));
                console.log(`  ← ${functionResponse}`);

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: functionResponse,
                });
            }

            response = await this.client.prompt({
                input: input.input,
                tools,
                messages,
            });
        }

        console.log("\n📤 FINAL RESPONSE:");
        console.log(JSON.stringify({
            status: response.status,
            content: response.content,
        }, null, 2));

        if (response.status === PromptResponseStatus.SUCCESS) {
            console.log("\n✅ SUCCESS - Forced function call completed");
        } else {
            console.log(`\n❌ ERROR: ${response.status}`);
        }

        console.log("=".repeat(80) + "\n");
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
            this.addSeparation();

            // NEW FUNCTION CALLING EXAMPLES
            await this.basicFunctionCalling();
            this.addSeparation();

            await this.multipleFunctionCalls();
            this.addSeparation();

            await this.functionCallingWithStructuredOutput();
            this.addSeparation();

            await this.forceSpecificFunction();

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