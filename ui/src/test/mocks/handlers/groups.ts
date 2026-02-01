import { http, HttpResponse } from 'msw';
import { createGroup } from '../../utils/factories';

export const groupHandlers = [
  // GET /api/groups/ - List group names
  http.get('**/groups/', ({ request }) => {
    const url = new URL(request.url);
    // Check if details endpoint
    if (url.pathname.endsWith('/details/')) {
      return HttpResponse.json({
        details: [createGroup(), createGroup({ name: 'test-group' })],
        cursor: null,
      });
    }
    return HttpResponse.json({
      names: ['default', 'test-group'],
      cursor: null,
    });
  }),

  // GET /api/groups/details/ - List groups with details
  http.get('**/groups/details/', () => {
    return HttpResponse.json({
      details: [createGroup(), createGroup({ name: 'test-group' })],
      cursor: null,
    });
  }),

  // GET /api/groups/:group/details/ - Get specific group details
  http.get('**/groups/:group/details/', ({ params }) => {
    return HttpResponse.json(
      createGroup({
        name: params.group as string,
      }),
    );
  }),

  // POST /api/groups/ - Create group
  http.post('**/groups/', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /api/groups/:group - Delete group
  http.delete('**/groups/:group', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // PATCH /api/groups/:group - Update group
  http.patch('**/groups/:group', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
