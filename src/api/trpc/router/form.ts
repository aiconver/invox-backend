import { transcribeForm, transcribeFormSchema } from "@/rpc/form/transcribe-form";
import { router } from "..";

import { authedProcedure } from "../procedures";
import { fillForm, fillFormSchema } from "@/rpc/form/fill-form";

export const formRouter = router({
  transcribe: authedProcedure
    .input(transcribeFormSchema)
    .mutation(({ input, ctx }) => transcribeForm(input, ctx)),

  fill: authedProcedure
    .input(fillFormSchema)
    .query(({ input, ctx }) => fillForm(input, ctx)),

});