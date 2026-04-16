import type { PaceModel } from "@engine/types";
import { stravaInferredModel } from "./stravaInferred";
import { minettiModel } from "./minetti";
import { re3Model } from "./re3";
import { ultrapacerModel } from "./ultrapacer";
import { thePacingProjectModel } from "./thePacingProject";

const ALL_MODELS: PaceModel[] = [
  stravaInferredModel,
  minettiModel,
  re3Model,
  ultrapacerModel,
  thePacingProjectModel,
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
