import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listGroups, createGroup, updateGroup, deleteGroup, getGroup } from './groups';
import { setMockCookie, clearMockCookie } from '../test/setup';
import { Group } from '@models';

describe('Groups API', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('listGroups', () => {
    it('returns group names when details=false', async () => {
      const errorHandler = vi.fn();
      const result = await listGroups(errorHandler, false);

      expect(result).toEqual(['default', 'test-group']);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns group details when details=true', async () => {
      const errorHandler = vi.fn();
      const result = await listGroups(errorHandler, true);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect((result as any[])[0]).toHaveProperty('name');
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('getGroup', () => {
    it('returns group details for specific group', async () => {
      const errorHandler = vi.fn();
      const result: Group | null = (await getGroup('default', errorHandler)) as Group | null;

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('name', 'default');
      expect(result).toHaveProperty('owners');
      expect(result).toHaveProperty('users');
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('createGroup', () => {
    it('returns true on successful creation', async () => {
      const errorHandler = vi.fn();
      const groupData = { name: 'new-group', description: 'Test group' };
      const result = await createGroup(groupData, errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('updateGroup', () => {
    it('returns true on successful update', async () => {
      const errorHandler = vi.fn();
      const updateData = { description: 'Updated description' };
      const result = await updateGroup('default', updateData, errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('deleteGroup', () => {
    it('returns true on successful deletion', async () => {
      const errorHandler = vi.fn();
      const result = await deleteGroup('test-group', errorHandler);

      expect(result).toBe(true);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });
});
