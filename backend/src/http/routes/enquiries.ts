import { Router, type RequestHandler } from 'express';
import type { EnquiryResponse } from '../../contract.js';
import { EnquirySchema, type EnquiryService } from '../../services/EnquiryService.js';
import { validationError } from '../errors.js';

export function enquiryRouter(enquiries: EnquiryService, limiter: RequestHandler): Router {
  const router = Router();

  router.post('/enquiries', limiter, async (req, res) => {
    const parsed = EnquirySchema.safeParse(req.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const { enquiryId } = await enquiries.submit(parsed.data);
    const body: EnquiryResponse = {
      enquiryId,
      message: 'Thank you for your enquiry. Our sales team will be in touch shortly.',
    };
    res.status(201).json(body);
  });

  return router;
}
