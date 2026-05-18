import { z } from 'zod';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { filterParams, timezoneParam, unitParam } from '@/lib/schema';
import { canViewWebsite } from '@/permissions';
import { getEventStats } from '@/queries/sql';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    startAt: z.coerce.number().int(),
    endAt: z.coerce.number().int(),
    unit: unitParam.optional(),
    timezone: timezoneParam,
    limit: z.coerce.number().optional(),
    ...filterParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    console.error('[events/series] validation error');
    return error();
  }

  const { websiteId } = await params;

  if (!(await canViewWebsite(auth, websiteId))) {
    console.error('[events/series] unauthorized');
    return unauthorized();
  }

  const { limit } = query;
  const filters = await getQueryFilters(query, websiteId);

  try {
    const data = await getEventStats(websiteId, { limit }, filters);
    console.log('[events/series] success rows=' + (Array.isArray(data) ? data.length : 'non-array'));
    return json(data);
  } catch (err: any) {
    console.error('[events/series] error', err?.message, err?.stack);
    throw err;
  }
}
