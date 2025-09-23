// src/controllers/formController.ts
import { Request, Response } from "express";
import { ApiResponse } from "../../types/ApiResponse";

// Services & types
import { FormService } from "../../services/formService";
import {
  GetFilledTemplateInput,
  GetFilledTemplateResult,
  TranscribeResponse,
} from "../../services/registry";

export class formController {
  private formService: FormService;

  constructor() {
    this.formService = new FormService();
  }

  /**
   * POST /api/v1/form/transcribe
   * Expects multipart/form-data with field: audio=<file>
   * Returns ApiResponse<TranscribeResponse>
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

  /**
   * POST /api/v1/form/fill
   * Body: GetFilledTemplateInput (JSON)
   * Optional: approach in body or query (?approach=perField|fullContext)
   * Returns ApiResponse<GetFilledTemplateResult>
   *
   * Notes:
   * - Accepts either `newTranscript` (preferred) or legacy `transcript`.
   * - `oldTranscript` is optional context.
   * - Validates `fields` array presence.
   * - Passes through few-shots and options.
   */
  async fillTemplate(req: Request, res: Response): Promise<void> {
    try {
      // Allow approach via query or body (defaults to "perField")
      const approachFromQuery = (req.query.approach as string | undefined)?.trim();
      const approachFromBody = (req.body?.approach as string | undefined)?.trim();
      const approach = "perField";

      // Body may arrive as parsed JSON; ensure correct type
      const body = req.body as GetFilledTemplateInput & {
        approach?: string;
        fewShots?: unknown;
      };

      // Normalize fewShots if it accidentally arrives as a JSON string
      if (typeof body.fewShots === "string") {
        try {
          (body as any).fewShots = JSON.parse(body.fewShots);
        } catch {
          // ignore; service will handle absence
          (body as any).fewShots = undefined;
        }
      }

      // Validation: fields
      if (!Array.isArray(body.fields) || body.fields.length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: "fields array is required.",
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(response);
        return;
      }

      // Validation: transcript presence (NEW or legacy)
      const hasNew =
        typeof (body as any).newTranscript === "string" &&
        !!(body as any).newTranscript.trim();
      const hasLegacy =
        typeof (body as any).transcript === "string" &&
        !!(body as any).transcript.trim();

      if (!hasNew && !hasLegacy) {
        const response: ApiResponse<null> = {
          success: false,
          error:
            "Transcript is required. Provide `newTranscript` (preferred) or legacy `transcript`.",
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(response);
        return;
      }

      // Call service with the selected approach
      const result = await this.formService.getFilledTemplate(body, approach);

      const response: ApiResponse<GetFilledTemplateResult> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(response);
    } catch (error: any) {
      // Map unknown approach errors (thrown by service) to 400
      const isApproachError =
        typeof error?.message === "string" &&
        /Unknown template filler approach/i.test(error.message);

      const response: ApiResponse<null> = {
        success: false,
        error: error?.message ?? "Failed to fill template",
        timestamp: new Date().toISOString(),
      };
      res.status(isApproachError ? 400 : 500).json(response);
    }
  }
}
