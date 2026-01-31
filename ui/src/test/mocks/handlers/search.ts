import { http, HttpResponse } from 'msw';
import { createSearchResponse } from '../../utils/factories';

export const searchHandlers = [
  // GET /api/search/ - Search with query and filters
  http.get('**/search/', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const cursor = url.searchParams.get('cursor');

    // Return empty results if no query
    if (!query) {
      return HttpResponse.json({ data: [], cursor: null });
    }

    return HttpResponse.json(createSearchResponse(3, cursor ? 'next-cursor' : null));
  }),
];
