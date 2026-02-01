import { userHandlers } from './users';
import { systemHandlers } from './system';
import { fileHandlers } from './files';
import { entityHandlers } from './entities';
import { reactionHandlers } from './reactions';
import { searchHandlers } from './search';
import { groupHandlers } from './groups';

export const handlers = [
  ...userHandlers,
  ...systemHandlers,
  ...fileHandlers,
  ...entityHandlers,
  ...reactionHandlers,
  ...searchHandlers,
  ...groupHandlers,
];
