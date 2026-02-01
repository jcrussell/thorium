import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSystemStats, getSystemSettings } from './system';
import { setMockCookie, clearMockCookie } from '../test/setup';
import { Stats } from '@models';

describe('System API', () => {
  beforeEach(() => {
    clearMockCookie();
    setMockCookie('THORIUM_TOKEN', 'test-token');
  });

  describe('getSystemStats', () => {
    it('returns system stats data', async () => {
      const errorHandler = vi.fn();
      const result: Stats | null = (await getSystemStats(errorHandler)) as Stats | null;

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('deadlines');
      expect(result).toHaveProperty('running');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('k8s');
      expect(result).toHaveProperty('baremetal');
      expect(result).toHaveProperty('external');
      expect(result).toHaveProperty('groups');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('returns stats with scaler information', async () => {
      const errorHandler = vi.fn();
      const result: Stats | null = (await getSystemStats(errorHandler)) as Stats | null;

      expect(result?.k8s).toHaveProperty('deadlines');
      expect(result?.k8s).toHaveProperty('running');
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('getSystemSettings', () => {
    it('returns system settings data', async () => {
      const errorHandler = vi.fn();
      const result: Record<string, unknown> | false = (await getSystemSettings(errorHandler)) as
        | Record<string, unknown>
        | false;

      expect(result).not.toBe(false);
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });
});
