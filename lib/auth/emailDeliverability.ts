const CHINESE_ISP_DOMAINS = ['qq.com', 'foxmail.com', '163.com', '126.com', 'yeah.net', 'sina.com', 'sohu.com', '139.com', '189.cn'];

const CONSUMER_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
]);

/** True when Firebase's default sender is unlikely to reach this mailbox. */
export function isLowDeliverabilityMailbox(email: string | null | undefined): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@').pop()?.toLowerCase() ?? '';
  if (!domain) return false;
  if (CHINESE_ISP_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  return !CONSUMER_MAIL_DOMAINS.has(domain);
}
