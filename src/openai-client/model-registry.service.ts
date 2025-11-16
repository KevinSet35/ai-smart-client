import { ModelMetadata, OPENAI_MODEL_REGISTRY, OpenAIModel } from "./config/model-registry";

export interface ModelComparison {
    model1: ModelMetadata;
    model2: ModelMetadata;
    differences: {
        contextWindow: number;
        pricingDifference: string;
        features: string[];
    };
}

export class ModelRegistry {
    /**
     * Get metadata for a specific model
     */
    getModelMetadata(model: OpenAIModel): ModelMetadata {
        const metadata = OPENAI_MODEL_REGISTRY[model];

        if (!metadata) {
            throw new Error(`Model metadata not found for: ${model}`);
        }

        return metadata;
    }

    /**
     * Get all available models
     */
    getAllModels(): OpenAIModel[] {
        return Object.keys(OPENAI_MODEL_REGISTRY) as OpenAIModel[];
    }

    /**
     * Get models by tier
     */
    getModelsByTier(tier: string): ModelMetadata[] {
        return Object.values(OPENAI_MODEL_REGISTRY).filter(
            (metadata) => metadata.tier === tier
        );
    }

    /**
     * Get models by pricing tier
     */
    getModelsByPricingTier(pricingTier: string): ModelMetadata[] {
        return Object.values(OPENAI_MODEL_REGISTRY).filter(
            (metadata) => metadata.pricingTier === pricingTier
        );
    }

    /**
     * Get models that support vision
     */
    getVisionModels(): ModelMetadata[] {
        return Object.values(OPENAI_MODEL_REGISTRY).filter(
            (metadata) => metadata.supportsVision
        );
    }

    /**
     * Get models that support function calling
     */
    getFunctionCallingModels(): ModelMetadata[] {
        return Object.values(OPENAI_MODEL_REGISTRY).filter(
            (metadata) => metadata.supportsFunctionCalling
        );
    }

    /**
     * Get models that support structured output
     */
    getStructuredOutputModels(): ModelMetadata[] {
        return Object.values(OPENAI_MODEL_REGISTRY).filter(
            (metadata) => metadata.supportsStructuredOutput
        );
    }

    /**
     * Check if a model supports a specific feature
     */
    supportsFeature(
        model: OpenAIModel,
        feature: "vision" | "functionCalling" | "structuredOutput"
    ): boolean {
        const metadata = this.getModelMetadata(model);

        switch (feature) {
            case "vision":
                return metadata.supportsVision;
            case "functionCalling":
                return metadata.supportsFunctionCalling;
            case "structuredOutput":
                return metadata.supportsStructuredOutput;
            default:
                return false;
        }
    }

    /**
     * Get recommended models for a specific use case
     */
    getRecommendedModels(useCase: string): ModelMetadata[] {
        return Object.values(OPENAI_MODEL_REGISTRY).filter((metadata) =>
            metadata.recommendedFor.some((rec) =>
                rec.toLowerCase().includes(useCase.toLowerCase())
            )
        );
    }

    /**
     * Get the cheapest model that meets requirements
     */
    getCheapestModel(requirements?: {
        supportsVision?: boolean;
        supportsFunctionCalling?: boolean;
        supportsStructuredOutput?: boolean;
        minContextWindow?: number;
    }): ModelMetadata | null {
        const pricingOrder = ["low", "medium", "high", "very_high"];

        let candidates = Object.values(OPENAI_MODEL_REGISTRY);

        // Apply filters
        if (requirements?.supportsVision) {
            candidates = candidates.filter((m) => m.supportsVision);
        }
        if (requirements?.supportsFunctionCalling) {
            candidates = candidates.filter((m) => m.supportsFunctionCalling);
        }
        if (requirements?.supportsStructuredOutput) {
            candidates = candidates.filter((m) => m.supportsStructuredOutput);
        }
        if (requirements?.minContextWindow !== undefined) {
            const minContext = requirements.minContextWindow; // Store in const for type narrowing
            candidates = candidates.filter((m) => m.contextWindow >= minContext);
        }

        // Sort by pricing tier
        candidates.sort((a, b) => {
            return pricingOrder.indexOf(a.pricingTier) - pricingOrder.indexOf(b.pricingTier);
        });

        return candidates[0] ?? null;
    }

    /**
     * Compare two models
     */
    compareModels(model1: OpenAIModel, model2: OpenAIModel): ModelComparison {
        const meta1 = this.getModelMetadata(model1);
        const meta2 = this.getModelMetadata(model2);

        const features: string[] = [];

        if (meta1.supportsVision !== meta2.supportsVision) {
            features.push("vision");
        }
        if (meta1.supportsFunctionCalling !== meta2.supportsFunctionCalling) {
            features.push("function calling");
        }
        if (meta1.supportsStructuredOutput !== meta2.supportsStructuredOutput) {
            features.push("structured output");
        }

        return {
            model1: meta1,
            model2: meta2,
            differences: {
                contextWindow: meta1.contextWindow - meta2.contextWindow,
                pricingDifference: `${meta1.pricingTier} vs ${meta2.pricingTier}`,
                features,
            },
        };
    }
}