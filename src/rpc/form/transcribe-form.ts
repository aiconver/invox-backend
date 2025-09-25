import { JwtUser } from "@/types/typed-request";
import z from "zod";

export const transcribeFormSchema = z.object({
  id: z.number().optional(), 
});

export async function transcribeForm(
  input: z.infer<typeof transcribeFormSchema>,
  { user }: { user: JwtUser }
) {
  const data = transcribeFormSchema.parse(input);

  return user;
}
