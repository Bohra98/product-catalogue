import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { buildTestApp } from './helpers.js';

const valid = {
  productId: 1,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+44 20 7946 0000',
  message: 'Do you ship to Ireland?',
};

describe('POST /api/enquiries', () => {
  it('sends the enquiry to the sales inbox and returns a thank-you message', async () => {
    const { app, mailer } = buildTestApp();
    const res = await request(app).post('/api/enquiries').send(valid).expect(201);

    expect(res.body.message).toMatch(/thank you/i);
    expect(res.body.enquiryId).toMatch(/^[0-9a-f-]{36}$/);

    expect(mailer.sent).toHaveLength(1);
    const email = mailer.sent[0]!;
    expect(email.to).toBe('sales@test.local');
    expect(email.from).toBe('catalogue@test.local');
    expect(email.replyTo).toBe('ada@example.com');
    expect(email.subject).toContain('Fjallraven');
    expect(email.text).toContain('Ada Lovelace');
    expect(email.text).toContain('Do you ship to Ireland?');
    expect(email.text).toContain(res.body.enquiryId);
  });

  it('uses the product title from the server, not anything the client sends', async () => {
    const { app, mailer } = buildTestApp();
    await request(app)
      .post('/api/enquiries')
      .send({ ...valid, title: 'Spoofed', price: 0 })
      .expect(201);
    expect(mailer.sent[0]!.subject).not.toContain('Spoofed');
  });

  it('accepts a missing phone number', async () => {
    const { app, mailer } = buildTestApp();
    const { phone: _phone, ...withoutPhone } = valid;
    await request(app).post('/api/enquiries').send(withoutPhone).expect(201);
    expect(mailer.sent[0]!.text).toContain('(not given)');
  });

  it('returns field errors and sends nothing for invalid input', async () => {
    const { app, mailer } = buildTestApp();
    const res = await request(app)
      .post('/api/enquiries')
      .send({ productId: 1, name: '', email: 'not-an-email', message: '' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['name', 'email', 'message']),
    );
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects line breaks in single-line fields (header injection)', async () => {
    const { app, mailer } = buildTestApp();
    const res = await request(app)
      .post('/api/enquiries')
      .send({ ...valid, name: 'Ada\r\nBcc: victim@example.com' })
      .expect(400);
    expect(res.body.error.fields.name).toBeDefined();
    expect(mailer.sent).toHaveLength(0);
  });

  it('404s for an unknown product', async () => {
    const { app, mailer } = buildTestApp();
    await request(app).post('/api/enquiries').send({ ...valid, productId: 999 }).expect(404);
    expect(mailer.sent).toHaveLength(0);
  });

  it('returns 503 when the mail provider fails', async () => {
    const { app, mailer } = buildTestApp();
    mailer.failNext = true;
    const res = await request(app).post('/api/enquiries').send(valid).expect(503);
    expect(res.body.error.code).toBe('MAIL_UNAVAILABLE');
  });

  it('returns 400 for malformed JSON', async () => {
    const { app } = buildTestApp();
    await request(app)
      .post('/api/enquiries')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
  });

  it('rate-limits repeated submissions', async () => {
    const { app } = buildTestApp({ config: { enquiryRateLimitPerMinute: 2 } });
    await request(app).post('/api/enquiries').send(valid).expect(201);
    await request(app).post('/api/enquiries').send(valid).expect(201);
    const res = await request(app).post('/api/enquiries').send(valid).expect(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
