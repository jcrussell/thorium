import { userHandlers } from './users';
import { systemHandlers } from './system';
import { fileHandlers } from './files';
import { entityHandlers } from './entities';

export const handlers = [...userHandlers, ...systemHandlers, ...fileHandlers, ...entityHandlers];
