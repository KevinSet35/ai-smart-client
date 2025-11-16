import OpenAI from "openai";
import { PromptInput } from "../types/prompt.types";
import { SchemaParser } from "../parsers/schema.parser";
import { OPENAI_MODEL_REGISTRY, OpenAIModel } from "../config/model-registry";

export class RequestBuilder {
    constructor(private schemaParser: SchemaParser) { }

    /**
     * Build request parameters for non-streaming request
     */
    buildRequestParams<TInput, TOutput>(
        input: PromptInput<TInput, TOutput>,
        model: OpenAIModel,
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        defaultTemperature: number,
        defaultMaxTokens?: number
    ): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
        const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            model,
            messages,
            temperature: input.temperature ?? defaultTemperature,
            max_tokens: input.maxTokens ?? defaultMaxTokens,
        };

        this.addStructuredOutput(requestParams, input.outputSchema, model);
        this.addTools(requestParams, input.tools, input.toolChoice, model);

        return requestParams;
    }

    /**
     * Build request parameters for streaming request
     */
    buildStreamingRequestParams<TInput, TOutput>(
        input: PromptInput<TInput, TOutput>,
        model: OpenAIModel,
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        defaultTemperature: number,
        defaultMaxTokens?: number
    ): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
        const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
            model,
            messages,
            temperature: input.temperature ?? defaultTemperature,
            max_tokens: input.maxTokens ?? defaultMaxTokens,
            stream: true,
        };

        this.addStructuredOutput(requestParams, input.outputSchema, model);
        this.addTools(requestParams, input.tools, input.toolChoice, model);

        return requestParams;
    }

    /**
     * Add structured output configuration to request params
     */
    private addStructuredOutput<T>(
        requestParams:
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        outputSchema: any,
        model: OpenAIModel
    ): void {
        if (!outputSchema) return;

        const modelMetadata = OPENAI_MODEL_REGISTRY[model];
        if (!modelMetadata.supportsStructuredOutput) return;

        const jsonSchema = this.schemaParser.zodToOpenAISchema(outputSchema);

        requestParams.response_format = {
            type: "json_schema",
            json_schema: {
                name: "response",
                schema: jsonSchema,
                strict: true,
            },
        };
    }

    /**
     * Add tools configuration to request params
     */
    private addTools(
        requestParams:
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
            | OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
        toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption | undefined,
        model: OpenAIModel
    ): void {
        if (!tools || tools.length === 0) return;

        const modelMetadata = OPENAI_MODEL_REGISTRY[model];
        if (!modelMetadata.supportsFunctionCalling) return;

        requestParams.tools = tools;
        if (toolChoice) {
            requestParams.tool_choice = toolChoice;
        }
    }
}