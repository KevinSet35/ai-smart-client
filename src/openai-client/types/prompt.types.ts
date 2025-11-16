import OpenAI from "openai";
import { z } from "zod";
import { OpenAIModel } from "../config/model-registry";

/**
 * Status of the prompt response
 */
export enum PromptResponseStatus {
    SUCCESS = "success",
    VALIDATION_ERROR = "validation_error",
    API_ERROR = "api_error",
    RATE_LIMIT_ERROR = "rate_limit_error",
    TIMEOUT_ERROR = "timeout_error",
    NETWORK_ERROR = "network_error",
    UNKNOWN_ERROR = "unknown_error",
}

/**
 * Input for prompt generation
 */
export interface PromptInput<TInput = string, TOutput = string> {
    /** User input message or structured data */
    input: TInput;
    /** Override default model for this request */
    model?: OpenAIModel;
    /** Override default temperature for this request */
    temperature?: number;
    /** Override default system message for this request */
    systemMessage?: string;
    /** Override default max tokens for this request */
    maxTokens?: number;
    /** Zod schema for structured output validation */
    outputSchema?: z.ZodType<TOutput>;
    /** Function/tool definitions for function calling */
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
    /** How the model should use tools: 'auto', 'none', or specific tool */
    toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
    /** Image URLs for vision-capable models */
    images?: string[];
    /** Additional conversation history */
    messages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

/**
 * Response from prompt generation
 */
export interface PromptResponse<TInput = string, TOutput = string> {
    /** Status of the response */
    status: PromptResponseStatus;
    /** Error message if status is not SUCCESS */
    error?: string;
    /** The generated content (validated against outputSchema if provided) */
    content: TOutput;
    /** Parsed and validated structured output (if outputSchema was provided) */
    structuredOutput?: TOutput;
    /** Tool calls made by the model (if tools were provided) */
    toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
    /** Token usage statistics */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** The model used for this completion */
    model: string;
    /** Finish reason */
    finishReason: string | null;
    /** Raw OpenAI response */
    raw: OpenAI.Chat.Completions.ChatCompletion;
    /** The original input that generated this response */
    input: PromptInput<TInput, TOutput>;
}