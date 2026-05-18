import { getCompareDate } from '@/lib/date';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { filterParams, withDateRange } from '@/lib/schema';
import { canViewWebsite } from '@/permissions';
import { getWebsiteEventStats } from '@/queries/sql/events/getWebsiteEventStats';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const schema = withDateRange({
    ...filterParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    console.error('[events/stats] validation error');
    return error();
  }

  const { websiteId } = await params;

  if (!(await canViewWebsite(auth, websiteId))) {
    console.error('[events/stats] unauthorized websiteId=' + websiteId);
    return unauthorized();
  }

  const filters = await getQueryFilters(query, websiteId);

  try {
    const data = await getWebsiteEventStats(websiteId, filters);

    const { startDate, endDate } = getCompareDate(
      filters.compare ?? 'prev',
      filters.startDate,
      filters.endDate,
    );

    const comparison = await getWebsiteEventStats(websiteId, {
      ...filters,
      startDate,
      endDate,
    });

    console.log('[events/stats] success', JSON.stringify({ data, comparison }));
    return json({ data: { ...data, comparison } });
  } catch (err: any) {
    console.error('[events/stats] error', err?.message, err?.stack);
    throw err;
  }
}
