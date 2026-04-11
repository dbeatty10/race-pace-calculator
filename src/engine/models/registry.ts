import type { PaceModel } from "@engine/types";
import { stravaInferredModel } from "./stravaInferred";
import { minettiModel } from "./minetti";
import { re3Model } from "./re3";

const ALL_MODELS: PaceModel[] = [
  stravaInferredModel,
  minettiModel,
  re3Model,
];

const MODEL_MAP = new Map(ALL_MODELS.map((m) => [m.id, m]));

export function listModels(): PaceModel[] {
  return ALL_MODELS;
}

export function getModel(id: string): PaceModel {
  const model = MODEL_MAP.get(id);
  if (!model) throw new Error(`Unknown model: ${id}`);
  return model;
}
