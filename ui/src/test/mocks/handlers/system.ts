import { http, HttpResponse } from 'msw';
import { createStats, createSystemSettings } from '../../utils/factories';

export const systemHandlers = [
  // GET /api/banner
  http.get('**/banner', () => {
    return HttpResponse.json('');
  }),

  // GET /api/system/stats - System stats
  http.get('**/system/stats', () => {
    return HttpResponse.json(createStats());
  }),

  // GET /api/system/settings - System settings
  http.get('**/system/settings', () => {
    return HttpResponse.json(createSystemSettings());
  }),

  // GET /api/pipelines/list/:group/ - List pipelines
  http.get('**/pipelines/list/:group/', () => {
    return HttpResponse.json({
      data: ['pipeline-1', 'pipeline-2'],
    });
  }),

  // GET /api/pipelines/list/:group/details/ - List pipelines with details
  http.get('**/pipelines/list/:group/details/', () => {
    return HttpResponse.json([
      { name: 'pipeline-1', group: 'default', description: 'Test pipeline 1', order: [] },
      { name: 'pipeline-2', group: 'default', description: 'Test pipeline 2', order: [] },
    ]);
  }),

  // GET /api/pipelines/:group/:pipeline - Get pipeline
  http.get('**/pipelines/:group/:pipeline', () => {
    return HttpResponse.json({
      name: 'pipeline-1',
      group: 'default',
      description: 'Test pipeline',
      order: [['stage-1'], ['stage-2']],
    });
  }),

];
