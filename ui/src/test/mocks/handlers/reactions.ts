import { http, HttpResponse } from 'msw';
import { createReaction, createReactionListResponse, createReactionLogsResponse } from '../../utils/factories';

export const reactionHandlers = [
  // POST /api/reactions/ - Create reaction
  http.post('**/reactions/', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: 'reaction-uuid-123',
      group: body.group || 'default',
      pipeline: body.pipeline || 'test-pipeline',
      status: 'Created',
    });
  }),

  // GET /api/reactions/:group/:uuid - Get reaction details
  http.get('**/reactions/:group/:uuid', ({ params }) => {
    const { group, uuid } = params as { group: string; uuid: string };
    return HttpResponse.json(
      createReaction({
        id: uuid,
        group: group,
      }),
    );
  }),

  // GET /api/reactions/logs/:group/:uuid - Get reaction logs
  http.get('**/reactions/logs/:group/:uuid', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createReactionLogsResponse(5, cursor ? parseInt(cursor) : null));
  }),

  // GET /api/reactions/logs/:group/:uuid/:stage - Get stage logs
  http.get('**/reactions/logs/:group/:uuid/:stage', () => {
    return HttpResponse.json({
      logs: ['Log line 1 for stage', 'Log line 2 for stage', 'Log line 3 for stage'],
    });
  }),

  // GET /api/reactions/list/:group/:pipeline/ - List reactions by pipeline
  http.get('**/reactions/list/:group/:pipeline/', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createReactionListResponse(3, cursor ? 'next-cursor' : null));
  }),

  // GET /api/reactions/list/:group/:pipeline/details/ - List reactions by pipeline with details
  http.get('**/reactions/list/:group/:pipeline/details/', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createReactionListResponse(3, cursor ? 'next-cursor' : null, true));
  }),

  // GET /api/reactions/tag/:group/:tag/ - List reactions by tag
  http.get('**/reactions/tag/:group/:tag/', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createReactionListResponse(3, cursor ? 'next-cursor' : null));
  }),

  // GET /api/reactions/tag/:group/:tag/details/ - List reactions by tag with details
  http.get('**/reactions/tag/:group/:tag/details/', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    return HttpResponse.json(createReactionListResponse(3, cursor ? 'next-cursor' : null, true));
  }),

  // DELETE /api/reactions/:group/:uuid - Delete reaction
  http.delete('**/reactions/:group/:uuid', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
