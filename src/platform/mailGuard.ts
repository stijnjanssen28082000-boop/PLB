import { APP_ENVIRONMENT, isProduction } from './environment';

/**
 * The guard from docs/environments.md D.7, built before the mail function is
 * first tested rather than after.
 *
 * The failure it prevents is concrete: a test inspection mailing its report to a
 * real tenant. Relying on "remember to use fake addresses while testing" is the
 * way that eventually happens, so in test every outgoing mail is rerouted to the
 * whitelisted address with the intended recipient in the subject.
 */

export interface OutgoingMail {
  to: string;
  subject: string;
  body: string;
}

export class MailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailConfigurationError';
  }
}

export interface MailGuardOptions {
  environment?: string;
  whitelist?: string[];
}

/**
 * Rewrites a mail for the active environment. Every send path calls this — there
 * is no second path that skips it.
 */
export function applyMailGuard(mail: OutgoingMail, options: MailGuardOptions = {}): OutgoingMail {
  const environment = options.environment ?? APP_ENVIRONMENT;
  const whitelist = options.whitelist ?? [];

  if (environment === 'production') {
    if (whitelist.length > 0) {
      // A whitelist in production would silently divert real reports away from
      // the tenant and landlord who are legally entitled to them.
      throw new MailConfigurationError(
        'A mail whitelist is configured in production. Remove VITE_MAIL_TEST_WHITELIST from the production environment.',
      );
    }
    return mail;
  }

  if (whitelist.length === 0) {
    // Refusing to send beats guessing: without a whitelist there is nothing
    // stopping this mail from reaching whoever is in the test data.
    throw new MailConfigurationError(
      `No mail whitelist configured for the ${environment} environment. ` +
        'Set VITE_MAIL_TEST_WHITELIST before sending mail outside production.',
    );
  }

  const intended = mail.to.trim().toLowerCase();
  const redirectTarget = whitelist[0] as string;

  if (whitelist.includes(intended)) {
    return mail;
  }

  return {
    to: redirectTarget,
    subject: `[TEST — origineel voor: ${mail.to}] ${mail.subject}`,
    body: mail.body,
  };
}

/** True when this build is allowed to mail arbitrary addresses. */
export const mailsRealRecipients = isProduction;
