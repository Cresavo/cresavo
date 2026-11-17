import { interpretCommandTask } from "./tasks/interpret-command";
import { structureJournalTask } from "./tasks/structure-journal";
import { writePostTask } from "./tasks/write-post";
import { suggestCampaignTask } from "./tasks/suggest-campaign";
import { stockForecastTask } from "./tasks/stock-forecast";
import { replyCustomerTask } from "./tasks/reply-customer";
import { dailySummaryTask } from "./tasks/daily-summary";
import { summarizeCustomerTask } from "./tasks/summarize-customer";
import { answerHelpTask } from "./tasks/answer-help";
export const tasks = {
  "interpret-command": interpretCommandTask, "structure-journal": structureJournalTask,
  "write-post": writePostTask, "suggest-campaign": suggestCampaignTask,
  "stock-forecast": stockForecastTask, "reply-customer": replyCustomerTask, "daily-summary": dailySummaryTask, "summarize-customer": summarizeCustomerTask, "answer-help": answerHelpTask,
};
export type TaskName = keyof typeof tasks;
export function isTaskName(name: string): name is TaskName { return Object.hasOwn(tasks, name); }
