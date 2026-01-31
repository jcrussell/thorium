import { http, HttpResponse } from 'msw';

export const systemHandlers = [
  // GET /api/banner
  http.get('**/banner', () => {
    return HttpResponse.json('');
  }),
];
