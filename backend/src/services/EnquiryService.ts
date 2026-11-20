import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Mailer } from '../mail/Mailer.js';
import type { ProductRepository } from '../repositories/ProductRepository.js';

/** Single-line text: no control characters, so nothing can break email headers. */
const singleLine = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Required')
    .max(max, `Must be ${max} characters or fewer`)
    .refine((s) => !/[\u0000-\u001f\u007f]/.test(s), 'Must not contain line breaks or control characters');

export const EnquirySchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: singleLine(100),
  email: z.string().trim().max(254).pipe(z.email('Enter a valid email address')),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+()\d\s.-]*$/, 'Use digits, spaces and + ( ) . - only')
    .optional()
    .transform((v) => (v ? v : undefined)),
  message: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(2000, 'Must be 2000 characters or fewer'),
});

export type EnquiryInput = z.infer<typeof EnquirySchema>;

export class ProductNotFoundError extends Error {
  constructor(readonly productId: number) {
    super(`Product ${productId} not found`);
    this.name = 'ProductNotFoundError';
  }
}

export interface EnquiryOptions {
  salesInbox: string;
  from: string;
}

export class EnquiryService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly mailer: Mailer,
    private readonly options: EnquiryOptions,
  ) {}

  /**
   * Looks the product up server-side (the client only sends an id, so the email
   * cannot claim a product or price the customer never saw), then hands the
   * email to the mailer. Resolves once the provider accepts the message.
   */
  async submit(input: EnquiryInput): Promise<{ enquiryId: string }> {
    const product = await this.repo.getById(input.productId);
    if (!product) throw new ProductNotFoundError(input.productId);

    const enquiryId = randomUUID();
    await this.mailer.send({
      to: this.options.salesInbox,
      from: this.options.from,
      replyTo: input.email,
      subject: `Product enquiry: ${product.title} (#${product.id})`,
      text: [
        `New enquiry ${enquiryId}`,
        '',
        `Product: ${product.title} (#${product.id})`,
        `Price:   ${product.price.toFixed(2)}`,
        '',
        `Name:    ${input.name}`,
        `Email:   ${input.email}`,
        `Phone:   ${input.phone ?? '(not given)'}`,
        '',
        'Message:',
        input.message,
      ].join('\n'),
    });
    return { enquiryId };
  }
}
