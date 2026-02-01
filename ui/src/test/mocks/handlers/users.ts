import { http, HttpResponse } from 'msw';
import { createUserInfo, createAdminUser, createAuthResponse } from '../../utils/factories';

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

  // GET /api/users/ - List user names (returns array directly)
  http.get('**/users/', () => {
    return HttpResponse.json(['testuser', 'admin', 'analyst1']);
  }),

  // GET /api/users/details/ - List users with details
  http.get('**/users/details/', () => {
    return HttpResponse.json([
      createUserInfo({ username: 'testuser', groups: ['default'] }),
      createAdminUser({ username: 'admin', groups: ['default', 'admins'] }),
      createUserInfo({ username: 'analyst1', groups: ['default'] }),
    ]);
  }),

  // GET /api/users/user/:username - Get single user
  http.get('**/users/user/:username', ({ params }) => {
    return HttpResponse.json(
      createUserInfo({ username: params.username as string }),
    );
  }),

  // PATCH /api/users/ - Update current user
  http.patch('**/users/', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // PATCH /api/users/user/:username - Update single user
  http.patch('**/users/user/:username', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /api/users/delete/:username - Delete user
  http.delete('**/users/delete/:username', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
