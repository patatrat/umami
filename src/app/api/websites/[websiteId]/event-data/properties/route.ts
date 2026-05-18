import { z } from 'zod';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { filterParams } from '@/lib/schema';
import { canViewWebsite } from '@/permissions';
import { getEventDataProperties } from '@/queries/sql';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = z.object({
    startAt: z.coerce.number().int(),
    endAt: z.coerce.number().int(),
    ...filterParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    console.error('[event-data/properties] validation error');
    return error();
  }

  const { websiteId } = await params;

  if (!(await canViewWebsite(auth, websiteId))) {
    console.error('[event-data/properties] unauthorized');
    return unauthorized();
  }

  const filters = await getQueryFilters(query, websiteId);

  try {
    const data = await getEventDataProperties(websiteId, filters);
    console.log('[event-data/properties] success rows=' + (Array.isArray(data) ? data.length : 'non-array'));
    return json(data);
  } catch (err: any) {
    console.error('[event-data/properties] error', err?.message, err?.stack);
    throw err;
  }
}
