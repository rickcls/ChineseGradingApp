import { readDrillFeedback, readDrillTask, type DrillFeedback, type DrillTask } from "./practiceDrill";

export type DrillView = {
  id: string;
  category: string;
  subcategory: string;
  task: DrillTask;
  response: string | null;
  feedback: DrillFeedback | null;
  attempts: number;
  completed: boolean;
};

export function toDrillView(drill: {
  id: string;
  category: string;
  subcategory: string;
  task: unknown;
  response: string | null;
  feedback: unknown;
  attempts: number;
  completedAt: Date | null;
}): DrillView | null {
  const task = readDrillTask(drill.task);
  if (!task) return null;
  return {
    id: drill.id,
    category: drill.category,
    subcategory: drill.subcategory,
    task,
    response: drill.response,
    feedback: readDrillFeedback(drill.feedback),
    attempts: drill.attempts,
    completed: drill.completedAt !== null,
  };
}
