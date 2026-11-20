import { describe, expect, it } from '@jest/globals';
import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
  it('provides safe local defaults with no env set', () => {
    const env = loadEnv({});
    expect(env).toMatchObject({
      PORT: 4000,
      PRODUCT_SOURCE: 'fakestore',
      MAIL_PROVIDER: 'file',
      FEATURED_COUNT: 5,
      CATEGORY_FEATURED_COUNT: 3,
    });
  });

  it('treats empty values as unset', () => {
    expect(loadEnv({ PORT: '' }).PORT).toBe(4000);
  });

  it('requires SMTP_HOST when MAIL_PROVIDER=smtp', () => {
    expect(() => loadEnv({ MAIL_PROVIDER: 'smtp' })).toThrow(/SMTP_HOST/);
    expect(loadEnv({ MAIL_PROVIDER: 'smtp', SMTP_HOST: 'mailpit' }).SMTP_HOST).toBe('mailpit');
  });

  it('lists every invalid variable', () => {
    expect(() => loadEnv({ PORT: 'abc', SALES_INBOX: 'nope' })).toThrow(/PORT[\s\S]*SALES_INBOX|SALES_INBOX[\s\S]*PORT/);
  });
});
