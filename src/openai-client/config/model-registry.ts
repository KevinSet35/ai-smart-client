export enum ModelTier {
    GPT_3_5 = "gpt-3.5",
    GPT_4 = "gpt-4",
    GPT_4_TURBO = "gpt-4-turbo",
    GPT_4O = "gpt-4o",
    O1 = "o1",
}

export enum PricingTier {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    VERY_HIGH = "very_high",
}

export enum OpenAIModel {
    GPT_3_5_TURBO = "gpt-3.5-turbo",
    GPT_3_5_TURBO_0125 = "gpt-3.5-turbo-0125",
    GPT_4 = "gpt-4",
    GPT_4_TURBO = "gpt-4-turbo",
    GPT_4_TURBO_PREVIEW = "gpt-4-turbo-preview",
    GPT_4_TURBO_2024_04_09 = "gpt-4-turbo-2024-04-09",
    GPT_4O = "gpt-4o",
    GPT_4O_2024_05_13 = "gpt-4o-2024-05-13",
    GPT_4O_2024_08_06 = "gpt-4o-2024-08-06",
    GPT_4O_MINI = "gpt-4o-mini",
    GPT_4O_MINI_2024_07_18 = "gpt-4o-mini-2024-07-18",
    O1_PREVIEW = "o1-preview",
    O1_PREVIEW_2024_09_12 = "o1-preview-2024-09-12",
    O1_MINI = "o1-mini",
    O1_MINI_2024_09_12 = "o1-mini-2024-09-12",
    O1 = "o1",
    O1_2024_12_17 = "o1-2024-12-17",
}

export interface ModelPricing {
    /** Price per 1M input tokens in USD */
    inputPer1M: number;
    /** Price per 1M output tokens in USD */
    outputPer1M: number;
}

export interface ModelMetadata {
    // The exact model identifier to use in API calls
    model: OpenAIModel;
    // Human-readable name for UI display
    displayName: string;
    // Detailed description of the model's capabilities and use cases
    description: string;
    // Whether the model supports structured output/JSON mode
    supportsStructuredOutput: boolean;
    // Maximum number of tokens the model can process (input + output)
    contextWindow: number;
    // Model family/generation tier
    tier: ModelTier;
    // Relative cost tier for API usage
    pricingTier: PricingTier;
    // Actual pricing in USD per 1M tokens
    pricing: ModelPricing;
    // Whether the model can process image inputs
    supportsVision: boolean;
    // Whether the model supports function/tool calling
    supportsFunctionCalling: boolean;
    // Date when the model's training data ends
    knowledgeCutoff?: string;
    // Date when the model was released
    releaseDate?: string;
    // List of use cases where this model excels
    recommendedFor: string[];
}

/**
 * OpenAI Model Registry
 * 
 * Last Updated: 2025-11-16
 * Source: https://platform.openai.com/docs/models
 * Pricing: https://openai.com/api/pricing/
 */
export const OPENAI_MODEL_REGISTRY: Record<OpenAIModel, ModelMetadata> = {
    // GPT-3.5 Models
    [OpenAIModel.GPT_3_5_TURBO]: {
        model: OpenAIModel.GPT_3_5_TURBO,
        displayName: "GPT-3.5 Turbo",
        description: "Standard GPT-3.5 model, good for general chat and completions",
        supportsStructuredOutput: true,
        contextWindow: 16385,
        tier: ModelTier.GPT_3_5,
        pricingTier: PricingTier.LOW,
        pricing: {
            inputPer1M: 0.50,
            outputPer1M: 1.50,
        },
        supportsVision: false,
        supportsFunctionCalling: true,
        knowledgeCutoff: "September 2021",
        recommendedFor: ["general chat", "simple tasks", "cost-sensitive applications"],
    },
    [OpenAIModel.GPT_3_5_TURBO_0125]: {
        model: OpenAIModel.GPT_3_5_TURBO_0125,
        displayName: "GPT-3.5 Turbo (Jan 2024)",
        description: "Snapshot of GPT-3.5 from January 2024",
        supportsStructuredOutput: true,
        contextWindow: 16385,
        tier: ModelTier.GPT_3_5,
        pricingTier: PricingTier.LOW,
        pricing: {
            inputPer1M: 0.50,
            outputPer1M: 1.50,
        },
        supportsVision: false,
        supportsFunctionCalling: true,
        knowledgeCutoff: "September 2021",
        releaseDate: "2024-01-25",
        recommendedFor: ["general chat", "simple tasks", "cost-sensitive applications"],
    },

    // GPT-4 Models
    [OpenAIModel.GPT_4]: {
        model: OpenAIModel.GPT_4,
        displayName: "GPT-4",
        description: "Original GPT-4 model, very capable but slower than newer models",
        supportsStructuredOutput: false,
        contextWindow: 8192,
        tier: ModelTier.GPT_4,
        pricingTier: PricingTier.VERY_HIGH,
        pricing: {
            inputPer1M: 30.00,
            outputPer1M: 60.00,
        },
        supportsVision: false,
        supportsFunctionCalling: true,
        knowledgeCutoff: "September 2021",
        recommendedFor: ["complex reasoning", "high-quality outputs"],
    },

    // GPT-4 Turbo Models
    [OpenAIModel.GPT_4_TURBO]: {
        model: OpenAIModel.GPT_4_TURBO,
        displayName: "GPT-4 Turbo",
        description: "Latest GPT-4 Turbo with structured output support and large context window",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4_TURBO,
        pricingTier: PricingTier.HIGH,
        pricing: {
            inputPer1M: 10.00,
            outputPer1M: 30.00,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "December 2023",
        recommendedFor: ["complex analysis", "structured outputs", "large documents", "vision tasks"],
    },
    [OpenAIModel.GPT_4_TURBO_PREVIEW]: {
        model: OpenAIModel.GPT_4_TURBO_PREVIEW,
        displayName: "GPT-4 Turbo Preview",
        description: "Preview version of GPT-4 Turbo",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4_TURBO,
        pricingTier: PricingTier.HIGH,
        pricing: {
            inputPer1M: 10.00,
            outputPer1M: 30.00,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "December 2023",
        recommendedFor: ["complex analysis", "structured outputs", "large documents"],
    },
    [OpenAIModel.GPT_4_TURBO_2024_04_09]: {
        model: OpenAIModel.GPT_4_TURBO_2024_04_09,
        displayName: "GPT-4 Turbo (April 2024)",
        description: "Snapshot of GPT-4 Turbo from April 2024",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4_TURBO,
        pricingTier: PricingTier.HIGH,
        pricing: {
            inputPer1M: 10.00,
            outputPer1M: 30.00,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "December 2023",
        releaseDate: "2024-04-09",
        recommendedFor: ["complex analysis", "structured outputs", "large documents", "vision tasks"],
    },

    // GPT-4o Models
    [OpenAIModel.GPT_4O]: {
        model: OpenAIModel.GPT_4O,
        displayName: "GPT-4o",
        description: "OpenAI's omni model with best performance-to-cost ratio",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4O,
        pricingTier: PricingTier.MEDIUM,
        pricing: {
            inputPer1M: 2.50,
            outputPer1M: 10.00,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "October 2023",
        recommendedFor: ["production APIs", "structured outputs", "general purpose", "vision tasks"],
    },
    [OpenAIModel.GPT_4O_2024_05_13]: {
        model: OpenAIModel.GPT_4O_2024_05_13,
        displayName: "GPT-4o (May 2024)",
        description: "Original GPT-4o release snapshot",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4O,
        pricingTier: PricingTier.MEDIUM,
        pricing: {
            inputPer1M: 5.00,
            outputPer1M: 15.00,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-05-13",
        recommendedFor: ["production APIs", "structured outputs", "general purpose", "vision tasks"],
    },
    [OpenAIModel.GPT_4O_2024_08_06]: {
        model: OpenAIModel.GPT_4O_2024_08_06,
        displayName: "GPT-4o (August 2024)",
        description: "Updated GPT-4o snapshot with improved structured outputs",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4O,
        pricingTier: PricingTier.MEDIUM,
        pricing: {
            inputPer1M: 2.50,
            outputPer1M: 10.00,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-08-06",
        recommendedFor: ["production APIs", "structured outputs", "general purpose", "vision tasks"],
    },
    [OpenAIModel.GPT_4O_MINI]: {
        model: OpenAIModel.GPT_4O_MINI,
        displayName: "GPT-4o Mini",
        description: "Smaller, cheaper version of GPT-4o for simpler tasks",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4O,
        pricingTier: PricingTier.LOW,
        pricing: {
            inputPer1M: 0.15,
            outputPer1M: 0.60,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "October 2023",
        recommendedFor: ["development", "testing", "simple tasks", "cost optimization"],
    },
    [OpenAIModel.GPT_4O_MINI_2024_07_18]: {
        model: OpenAIModel.GPT_4O_MINI_2024_07_18,
        displayName: "GPT-4o Mini (July 2024)",
        description: "Snapshot of GPT-4o Mini from July 2024",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.GPT_4O,
        pricingTier: PricingTier.LOW,
        pricing: {
            inputPer1M: 0.15,
            outputPer1M: 0.60,
        },
        supportsVision: true,
        supportsFunctionCalling: true,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-07-18",
        recommendedFor: ["development", "testing", "simple tasks", "cost optimization"],
    },

    // o1 Reasoning Models
    [OpenAIModel.O1_PREVIEW]: {
        model: OpenAIModel.O1_PREVIEW,
        displayName: "o1 Preview",
        description: "Reasoning model optimized for complex problem-solving (no streaming or function calling)",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.O1,
        pricingTier: PricingTier.VERY_HIGH,
        pricing: {
            inputPer1M: 15.00,
            outputPer1M: 60.00,
        },
        supportsVision: true,
        supportsFunctionCalling: false,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-09-12",
        recommendedFor: ["complex reasoning", "mathematics", "scientific problems", "code generation"],
    },
    [OpenAIModel.O1_PREVIEW_2024_09_12]: {
        model: OpenAIModel.O1_PREVIEW_2024_09_12,
        displayName: "o1 Preview (September 2024)",
        description: "Snapshot of o1 preview from September 2024",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.O1,
        pricingTier: PricingTier.VERY_HIGH,
        pricing: {
            inputPer1M: 15.00,
            outputPer1M: 60.00,
        },
        supportsVision: true,
        supportsFunctionCalling: false,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-09-12",
        recommendedFor: ["complex reasoning", "mathematics", "scientific problems", "code generation"],
    },
    [OpenAIModel.O1_MINI]: {
        model: OpenAIModel.O1_MINI,
        displayName: "o1 Mini",
        description: "Faster, cheaper reasoning model for STEM tasks (no streaming or function calling)",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.O1,
        pricingTier: PricingTier.HIGH,
        pricing: {
            inputPer1M: 3.00,
            outputPer1M: 12.00,
        },
        supportsVision: true,
        supportsFunctionCalling: false,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-09-12",
        recommendedFor: ["coding", "mathematics", "STEM problems", "cost-sensitive reasoning"],
    },
    [OpenAIModel.O1_MINI_2024_09_12]: {
        model: OpenAIModel.O1_MINI_2024_09_12,
        displayName: "o1 Mini (September 2024)",
        description: "Snapshot of o1 mini from September 2024",
        supportsStructuredOutput: true,
        contextWindow: 128000,
        tier: ModelTier.O1,
        pricingTier: PricingTier.HIGH,
        pricing: {
            inputPer1M: 3.00,
            outputPer1M: 12.00,
        },
        supportsVision: true,
        supportsFunctionCalling: false,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-09-12",
        recommendedFor: ["coding", "mathematics", "STEM problems", "cost-sensitive reasoning"],
    },
    [OpenAIModel.O1]: {
        model: OpenAIModel.O1,
        displayName: "o1",
        description: "Full o1 reasoning model with enhanced capabilities (no streaming or function calling)",
        supportsStructuredOutput: true,
        contextWindow: 200000,
        tier: ModelTier.O1,
        pricingTier: PricingTier.VERY_HIGH,
        pricing: {
            inputPer1M: 15.00,
            outputPer1M: 60.00,
        },
        supportsVision: true,
        supportsFunctionCalling: false,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-12-17",
        recommendedFor: ["complex reasoning", "research", "advanced problem-solving", "mathematics"],
    },
    [OpenAIModel.O1_2024_12_17]: {
        model: OpenAIModel.O1_2024_12_17,
        displayName: "o1 (December 2024)",
        description: "Snapshot of o1 from December 2024",
        supportsStructuredOutput: true,
        contextWindow: 200000,
        tier: ModelTier.O1,
        pricingTier: PricingTier.VERY_HIGH,
        pricing: {
            inputPer1M: 15.00,
            outputPer1M: 60.00,
        },
        supportsVision: true,
        supportsFunctionCalling: false,
        knowledgeCutoff: "October 2023",
        releaseDate: "2024-12-17",
        recommendedFor: ["complex reasoning", "research", "advanced problem-solving", "mathematics"],
    },
};