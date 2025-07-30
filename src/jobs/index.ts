import { startOneTimeImportFormTemplate } from "./import-form-template";

export async function registerCronJobs() {
  // Run the one-time job at startup
  await startOneTimeImportFormTemplate();

  // You can add more jobs here in the future
}