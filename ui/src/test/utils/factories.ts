import { UserInfo, UserAuthResponse, RoleKey, Sample, SubmissionChunk, CreateTags, Origin, Tags, Device, Vendor, Entities } from '@models';

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

export function createSubmissionChunk(overrides: Partial<SubmissionChunk> = {}): SubmissionChunk {
  return {
    id: generateId(),
    name: 'test-sample.exe',
    description: 'Test submission description',
    groups: ['default'],
    submitter: 'testuser',
    uploaded: new Date().toISOString(),
    origin: { None: 'None' } as Origin,
    ...overrides,
  };
}

export function createFullSample(overrides: Partial<Sample> = {}): Sample {
  return {
    sha256: 'abcd1234'.repeat(8),
    sha1: 'ef567890'.repeat(5),
    md5: '12345678'.repeat(4),
    tags: {} as Tags,
    submissions: [createSubmissionChunk()],
    comments: [],
    ...overrides,
  };
}

export function createFileListResponse(count = 3, cursor: string | null = null) {
  const files = Array.from({ length: count }, (_, i) =>
    createFullSample({
      sha256: `${'abcd1234'.repeat(7)}${String(i).padStart(8, '0')}`,
    }),
  );
  return {
    data: files,
    cursor: cursor,
  };
}

export function createTags(overrides: Partial<CreateTags> = {}): CreateTags {
  return {
    malware: ['trojan', 'ransomware'],
    ...overrides,
  };
}

export function createDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: overrides.id || generateId(),
    name: 'Test Device',
    kind: Entities.Device,
    description: 'A test device for unit testing',
    submitter: 'testuser',
    groups: ['default'],
    created: new Date().toISOString(),
    tags: {},
    metadata: {
      Device: {
        urls: ['https://example.com'],
        vendors: [],
        critical_system: false,
        sensitive_location: false,
        critical_sectors: [],
      },
    },
    ...overrides,
  };
}

export function createVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: overrides.id || generateId(),
    name: 'Test Vendor',
    kind: Entities.Vendor,
    description: 'A test vendor for unit testing',
    submitter: 'testuser',
    groups: ['default'],
    created: new Date().toISOString(),
    tags: {},
    metadata: {
      Vendor: {
        countries: [{ code: 'US', name: 'United States of America' }],
        critical_sectors: [],
      },
    },
    ...overrides,
  };
}

export function createEntityListResponse(count = 3, cursor: string | null = null) {
  const entities = Array.from({ length: count }, (_, i) =>
    createDevice({
      id: `entity-${String(i).padStart(8, '0')}`,
      name: `Device ${i}`,
    }),
  );
  return {
    data: entities,
    cursor: cursor,
  };
}
