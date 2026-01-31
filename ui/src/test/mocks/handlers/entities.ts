import { http, HttpResponse } from 'msw';
import { createDevice, createVendor, createEntityListResponse } from '../../utils/factories';

export const entityHandlers = [
  // POST /api/entities/ - Create entity
  http.post('**/entities/', () => {
    return HttpResponse.json({ id: 'new-entity-uuid' });
  }),

  // GET /api/entities/:id - Get entity details
  http.get('**/entities/:id', ({ params }) => {
    const id = params.id as string;
    // Return device by default, tests can override for vendor
    return HttpResponse.json(createDevice({ id }));
  }),

  // PATCH /api/entities/:id - Update entity
  http.patch('**/entities/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /api/entities/:id - Delete entity
  http.delete('**/entities/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/entities - List entities
  http.get('**/entities', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createEntityListResponse(3, cursor ? 'next-cursor' : null));
  }),

  // GET /api/entities/details/ - List entities with details
  http.get('**/entities/details/', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createEntityListResponse(3, cursor ? 'next-cursor' : null));
  }),
];
