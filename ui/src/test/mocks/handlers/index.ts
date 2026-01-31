import { userHandlers } from './users';
import { systemHandlers } from './system';
import { fileHandlers } from './files';

export const handlers = [...userHandlers, ...systemHandlers, ...fileHandlers];
