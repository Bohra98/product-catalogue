import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import type { Product } from '../api/types';

type Fields = { name: string; email: string; phone: string; message: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: '', email: '', phone: '', message: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Light client-side checks for fast feedback. The backend validates again and
 * is the source of truth; its field errors are shown the same way.
 */
function validate(f: Fields): FieldErrors {
  const errors: FieldErrors = {};
  if (!f.name.trim()) errors.name = 'Enter your name';
  if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Enter a valid email address';
  if (!f.message.trim()) errors.message = 'Enter a message';
  return errors;
}

export function EnquiryForm({ product }: { product: Product }) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState<'editing' | 'submitting' | 'sent'>('editing');
  const [thanks, setThanks] = useState('');
  const thanksRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state === 'sent') thanksRef.current?.focus();
  }, [state]);

  if (state === 'sent') {
    return (
      <section className="enquiry enquiry--sent" aria-live="polite">
        <h2 tabIndex={-1} ref={thanksRef}>
          Thank you!
        </h2>
        <p>{thanks}</p>
      </section>
    );
  }

  const update = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validate(fields);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setState('submitting');
    try {
      const res = await api.submitEnquiry({
        productId: product.id,
        name: fields.name.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim() || undefined,
        message: fields.message.trim(),
      });
      setThanks(res.message);
      setState('sent');
    } catch (err) {
      setState('editing');
      if (err instanceof ApiError) {
        setErrors(err.fields as FieldErrors);
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  }

  const submitting = state === 'submitting';

  return (
    <section className="enquiry" aria-labelledby="enquiry-heading">
      <h2 id="enquiry-heading">Enquire about this product</h2>
      <form onSubmit={onSubmit} noValidate>
        <Field id="enquiry-name" label="Name" error={errors.name}>
          <input id="enquiry-name" autoComplete="name" maxLength={100} value={fields.name} onChange={update('name')} {...describedBy('enquiry-name', errors.name)} />
        </Field>
        <Field id="enquiry-email" label="Email" error={errors.email}>
          <input id="enquiry-email" type="email" autoComplete="email" maxLength={254} value={fields.email} onChange={update('email')} {...describedBy('enquiry-email', errors.email)} />
        </Field>
        <Field id="enquiry-phone" label="Phone (optional)" error={errors.phone}>
          <input id="enquiry-phone" type="tel" autoComplete="tel" maxLength={30} value={fields.phone} onChange={update('phone')} {...describedBy('enquiry-phone', errors.phone)} />
        </Field>
        <Field id="enquiry-message" label="Message" error={errors.message}>
          <textarea id="enquiry-message" rows={5} maxLength={2000} value={fields.message} onChange={update('message')} {...describedBy('enquiry-message', errors.message)} />
        </Field>
        {formError && (
          <p className="status status--error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
    </section>
  );
}

function describedBy(id: string, error: string | undefined) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
