import { describe, expect, it } from 'vitest';
import { MailConfigurationError, applyMailGuard } from './mailGuard';

const REPORT = {
  to: 'huurder@voorbeeld.be',
  subject: 'Uw plaatsbeschrijving',
  body: 'Beste, in bijlage vindt u de plaatsbeschrijving.',
};

const WHITELIST = ['stijn@monet.be', 'zaakvoerder@monet.be'];

describe('mail guard', () => {
  it('reroutes a test mail away from a real tenant', () => {
    const sent = applyMailGuard(REPORT, { environment: 'test', whitelist: WHITELIST });

    expect(sent.to).toBe('stijn@monet.be');
    // The intended recipient stays visible, so a test still shows who it was for.
    expect(sent.subject).toBe('[TEST — origineel voor: huurder@voorbeeld.be] Uw plaatsbeschrijving');
    expect(sent.body).toBe(REPORT.body);
  });

  it('leaves a whitelisted recipient alone', () => {
    const sent = applyMailGuard(
      { ...REPORT, to: 'zaakvoerder@monet.be' },
      { environment: 'test', whitelist: WHITELIST },
    );

    expect(sent).toEqual({ ...REPORT, to: 'zaakvoerder@monet.be' });
  });

  it('matches the whitelist regardless of case or padding', () => {
    const sent = applyMailGuard(
      { ...REPORT, to: '  Zaakvoerder@Monet.BE ' },
      { environment: 'test', whitelist: WHITELIST },
    );

    expect(sent.subject).toBe(REPORT.subject);
  });

  it('refuses to send at all when no whitelist is configured outside production', () => {
    expect(() => applyMailGuard(REPORT, { environment: 'test', whitelist: [] })).toThrow(
      MailConfigurationError,
    );
  });

  it('delivers to the real recipient in production', () => {
    expect(applyMailGuard(REPORT, { environment: 'production', whitelist: [] })).toEqual(REPORT);
  });

  it('rejects a whitelist left behind in production', () => {
    // Otherwise a stray test setting would quietly withhold reports from the
    // tenant and landlord who are entitled to them.
    expect(() => applyMailGuard(REPORT, { environment: 'production', whitelist: WHITELIST })).toThrow(
      MailConfigurationError,
    );
  });
});
