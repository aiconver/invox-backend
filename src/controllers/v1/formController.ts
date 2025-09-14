// src/controllers/formController.ts
import { Request, Response } from "express";
import { formService, TranscribeResponse } from "@/services/formService";
import { ApiResponse } from "@/types/ApiResponse";

export class formController {
  private formService: formService;

  constructor() {
    this.formService = new formService();
  }

  /**
   * POST /api/form/transcribe
   * Expects multipart/form-data with field: audio=<file>
   * Returns ApiResponse<{ transcript: string }>
   */
  async transcribe(req: Request, res: Response): Promise<void> {
    try {
      const file = (req as any).file as
        | { buffer: Buffer; originalname: string; mimetype: string }
        | undefined;

      if (!file || !file.buffer?.length) {
        const response: ApiResponse<null> = {
          success: false,
          error:
            "Missing 'audio' file. Send as multipart/form-data with field name 'audio'.",
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.formService.getAudioTranscript({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      });

      const response: ApiResponse<TranscribeResponse> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error: any) {
      const response: ApiResponse<null> = {
        success: false,
        error: error?.message ?? "Failed to transcribe audio",
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(response);
    }
  }
}
