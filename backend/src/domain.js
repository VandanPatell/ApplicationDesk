export const statuses = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];
export const workModes = ['Remote', 'Hybrid', 'On-site'];
export function renderTemplate(text, variables) {
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => variables[key] ?? match);
}
export function validateJob(body) {
  if (!body.company?.trim() || !body.role?.trim()) return 'Company and role are required.';
  if (body.status && !statuses.includes(body.status)) return 'Invalid application status.';
  if (body.workMode && !workModes.includes(body.workMode)) return 'Invalid work arrangement.';
  if (['Hybrid', 'On-site'].includes(body.workMode) && (typeof body.location !== 'string' || !body.location.trim())) return 'City is required for Hybrid and On-site positions.';
  if (body.tags && (!Array.isArray(body.tags) || body.tags.some(t => typeof t !== 'string'))) return 'Tags must be text values.';
  for (const key of ['appliedAt', 'followUpAt']) if (body[key] && Number.isNaN(Date.parse(body[key]))) return `Invalid ${key} date.`;
  if (body.url && !/^https?:\/\//i.test(body.url)) return 'Posting URL must start with http:// or https://.';
  return null;
}
