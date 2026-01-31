import { userHandlers } from './users';
import { systemHandlers } from './system';

export const handlers = [...userHandlers, ...systemHandlers];
