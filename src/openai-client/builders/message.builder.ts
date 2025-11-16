import OpenAI from "openai";
import { PromptInput } from "../types/prompt.types";
import { OPENAI_MODEL_REGISTRY, OpenAIModel } from "../config/model-registry";

export class MessageBuilder {
    /**
     * Build the messages array for the request
     */
    buildMessages<TInput, TOutput>(
        input: PromptInput<TInput, TOutput>,
        model: OpenAIModel,
        defaultSystemMessage?: string
    ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        this.addSystemMessage(messages, input.systemMessage ?? defaultSystemMessage);
        this.addConversationHistory(messages, input.messages);
        this.addUserInput(messages, input, model);

        return messages;
    }

    /**
     * Add system message to messages array
     */
    private addSystemMessage(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        systemMessage?: string
    ): void {
        if (systemMessage) {
            messages.push({
                role: "system",
                content: systemMessage,
            });
        }
    }

    /**
     * Add conversation history to messages array
     */
    private addConversationHistory(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        history?: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    ): void {
        if (history) {
            messages.push(...history);
        }
    }

    /**
     * Add user input to messages array
     */
    private addUserInput<TInput, TOutput>(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        input: PromptInput<TInput, TOutput>,
        model: OpenAIModel
    ): void {
        const hasImages = input.images && input.images.length > 0;
        const modelMetadata = OPENAI_MODEL_REGISTRY[model];

        if (hasImages && modelMetadata.supportsVision) {
            this.addVisionUserMessage(messages, input);
        } else {
            this.addTextUserMessage(messages, input);
        }
    }

    /**
     * Add vision user message with images
     */
    private addVisionUserMessage<TInput, TOutput>(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        input: PromptInput<TInput, TOutput>
    ): void {
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: this.stringifyInput(input.input),
            },
        ];

        for (const imageUrl of input.images!) {
            content.push({
                type: "image_url",
                image_url: { url: imageUrl },
            });
        }

        messages.push({
            role: "user",
            content,
        });
    }

    /**
     * Add text user message
     */
    private addTextUserMessage<TInput, TOutput>(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        input: PromptInput<TInput, TOutput>
    ): void {
        messages.push({
            role: "user",
            content: this.stringifyInput(input.input),
        });
    }

    /**
     * Convert input to string format
     */
    private stringifyInput<T>(input: T): string {
        return typeof input === "string" ? input : JSON.stringify(input);
    }
}