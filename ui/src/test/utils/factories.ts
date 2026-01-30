import { UserInfo, UserAuthResponse, RoleKey } from '@models';

let idCounter = 0;

function generateId(): string {
  return `test-id-${++idCounter}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function createUserInfo(overrides: Partial<UserInfo> = {}): UserInfo {
  return {
    username: 'testuser',
    role: { [RoleKey.User]: 'User' } as UserInfo['role'],
    email: 'testuser@example.com',
    groups: [],
    token: 'test-token-123',
    token_expiration: new Date(Date.now() + 86400000).toISOString(),
    settings: {
      theme: 'Light',
    },
    local: true,
    verified: true,
    ...overrides,
  };
}

export function createAdminUser(overrides: Partial<UserInfo> = {}): UserInfo {
  return createUserInfo({
    username: 'admin',
    role: { [RoleKey.Admin]: 'Admin' } as UserInfo['role'],
    ...overrides,
  });
}

export function createAuthResponse(overrides: Partial<UserAuthResponse> = {}): UserAuthResponse {
  return {
    token: 'test-token-123',
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

export interface MockEntity {
  id: string;
  name: string;
  type: string;
  created: string;
}

export function createEntity(overrides: Partial<MockEntity> = {}): MockEntity {
  return {
    id: generateId(),
    name: 'Test Entity',
    type: 'generic',
    created: new Date().toISOString(),
    ...overrides,
  };
}

export interface MockSample {
  sha256: string;
  filename: string;
  size: number;
  submitted: string;
}

export function createSample(overrides: Partial<MockSample> = {}): MockSample {
  return {
    sha256: 'abcd1234'.repeat(8),
    filename: 'test-file.exe',
    size: 1024,
    submitted: new Date().toISOString(),
    ...overrides,
  };
}
