import { http, HttpResponse } from 'msw';
import { createUserInfo, createAuthResponse } from '../../utils/factories';

export const userHandlers = [
  // GET /api/users/whoami - match various URL patterns
  http.get('**/users/whoami', () => {
    return HttpResponse.json(createUserInfo());
  }),

  // POST /api/users/auth
  http.post('**/users/auth', () => {
    return HttpResponse.json(createAuthResponse());
  }),

  // POST /api/users/logout
  http.post('**/users/logout', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // POST /api/users/ (create user)
  http.post('**/users/', () => {
    return HttpResponse.json(createAuthResponse());
  }),
];
