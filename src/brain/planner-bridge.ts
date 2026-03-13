import type { Brain, PlannerRuntime } from "./types.ts";
import { ToolCallingPlannerRuntime } from "./planner-runtime.ts";

export { ToolCallingPlannerRuntime };

// Backward-compatible alias for older imports that still refer to "brain".
export class PlannerBrain extends ToolCallingPlannerRuntime implements Brain, PlannerRuntime {}
