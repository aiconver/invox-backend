import { getAudioTranscript } from "./transcriptionService";
import { templateFillers } from "./templateFiller";
import {
  UploadFile,
  TranscribeResponse,
  GetFilledTemplateInput,
  GetFilledTemplateResult,
} from "./registry";

export class FormService {
  async getAudioTranscript(file: UploadFile): Promise<TranscribeResponse> {
    return getAudioTranscript(file);
  }

  async getFilledTemplate(
    input: GetFilledTemplateInput,
    approach: keyof typeof templateFillers = "perField"
  ): Promise<GetFilledTemplateResult> {
    const filler = templateFillers[approach];
    if (!filler) throw new Error(`Unknown template filler approach: ${approach}`);
    return filler(input);
  }
}
