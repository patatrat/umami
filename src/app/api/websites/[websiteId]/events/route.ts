import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { filterParams, pagingParams, searchParams, withDateRange } from '@/lib/schema';
import { canViewWebsite } from '@/permissions';
import { getWebsiteEvents } from '@/queries/sql';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = withDateRange({
    ...filterParams,
    ...pagingParams,
    ...searchParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    console.error('[events] validation error');
    return error();
  }

  const { websiteId } = await params;

  if (!(await canViewWebsite(auth, websiteId))) {
    console.error('[events] unauthorized');
    return unauthorized();
  }

  const filters = await getQueryFilters(query, websiteId);

  try {
    const data = await getWebsiteEvents(websiteId, filters);
    console.log('[events] success', JSON.stringify({ count: (data as any)?.count }));
    return json(data);
  } catch (err: any) {
    console.error('[events] error', err?.message, err?.stack);
    throw err;
  }
}
