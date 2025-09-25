import { JwtUser } from "@/types/typed-request";
import z from "zod";

export const fillFormSchema = z.object({
});

export async function fillForm(
  input: z.infer<typeof fillFormSchema>,
  { user }: { user: JwtUser }
) {
  const data = fillFormSchema.parse(input);

  return data;
}
