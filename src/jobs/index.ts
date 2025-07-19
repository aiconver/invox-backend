import { startOneTimeImportFormTemplate } from "./import-form-template";
import { startOneTimeImportForm } from "./import-form";

export async function registerCronJobs() {
  // Run the one-time job at startup
  await startOneTimeImportFormTemplate();

  await startOneTimeImportForm();

  // You can add more jobs here in the future
}