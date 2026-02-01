import { UserInfo, UserAuthResponse, RoleKey, Sample, SubmissionChunk, CreateTags, Origin, Tags, Device, Vendor, Entities, Group, GroupUsers, GroupAllowed, Stats, ScalerStats, GroupsStats } from '@models';

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
    role: 'User' as UserInfo['role'],
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
    role: 'Admin' as UserInfo['role'],
    ...overrides,
  });
}

export function createDeveloperUser(overrides: Partial<UserInfo> = {}): UserInfo {
  return createUserInfo({
    username: 'developer',
    role: {
      Developer: {
        k8s: true,
        bare_metal: false,
        windows: false,
        external: false,
      },
    } as UserInfo['role'],
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

// Reaction factories
export interface MockReaction {
  id: string;
  group: string;
  pipeline: string;
  status: string;
  creator: string;
  created: string;
  samples: string[];
  tags: string[];
  sla: number;
  args: Record<string, unknown>;
}

export function createReaction(overrides: Partial<MockReaction> = {}): MockReaction {
  return {
    id: overrides.id || generateId(),
    group: 'default',
    pipeline: 'test-pipeline',
    status: 'Completed',
    creator: 'testuser',
    created: new Date().toISOString(),
    samples: ['abcd1234'.repeat(8)],
    tags: ['test-sha256'],
    sla: 30,
    args: {},
    ...overrides,
  };
}

export function createReactionListResponse(count = 3, cursor: string | null = null, details = false) {
  if (details) {
    const reactions = Array.from({ length: count }, (_, i) =>
      createReaction({
        id: `reaction-${String(i).padStart(8, '0')}`,
        pipeline: `pipeline-${i}`,
      }),
    );
    return {
      details: reactions,
      cursor: cursor,
    };
  }
  const reactionIds = Array.from({ length: count }, (_, i) => `reaction-${String(i).padStart(8, '0')}`);
  return {
    reactions: reactionIds,
    cursor: cursor,
  };
}

export interface MockReactionLogEntry {
  timestamp: string;
  action: string;
  update: Record<string, unknown>;
}

export function createReactionLogEntry(overrides: Partial<MockReactionLogEntry> = {}): MockReactionLogEntry {
  return {
    timestamp: new Date().toISOString(),
    action: 'JobCreated',
    update: {
      id: 'job-123',
      stage: 'test-stage',
    },
    ...overrides,
  };
}

export function createReactionLogsResponse(count = 5, cursor: number | null = null) {
  const logs = Array.from({ length: count }, (_, i) =>
    createReactionLogEntry({
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      action: i % 2 === 0 ? 'JobCreated' : 'JobCompleted',
    }),
  );
  return logs;
}

// Search factories
export interface MockSearchResult {
  id: string;
  index: string;
  highlight: Record<string, string>;
}

export function createSearchResult(overrides: Partial<MockSearchResult> = {}): MockSearchResult {
  return {
    id: `${'abcd1234'.repeat(8)}-default`,
    index: 'thorium_sample_results',
    highlight: {
      data: '@kibana-highlighted-field@test match@/kibana-highlighted-field@',
    },
    ...overrides,
  };
}

export function createSearchResponse(count = 3, cursor: string | null = null) {
  const results = Array.from({ length: count }, (_, i) =>
    createSearchResult({
      id: `${'abcd1234'.repeat(7)}${String(i).padStart(8, '0')}-group${i}`,
      index: i % 2 === 0 ? 'thorium_sample_results' : 'thorium_sample_tags',
    }),
  );
  return {
    data: results,
    cursor: cursor,
  };
}

// Group factories
export function createGroupUsers(overrides: Partial<GroupUsers> = {}): GroupUsers {
  return {
    combined: ['testuser', 'admin'],
    direct: ['testuser'],
    metagroups: ['admins'],
    ...overrides,
  };
}

export function createGroupAllowed(overrides: Partial<GroupAllowed> = {}): GroupAllowed {
  return {
    files: true,
    repos: true,
    tags: true,
    images: true,
    pipelines: true,
    reactions: true,
    results: true,
    comments: true,
    entities: true,
    ...overrides,
  };
}

export function createGroup(overrides: Partial<Group> = {}): Group {
  return {
    name: 'default',
    owners: createGroupUsers({ combined: ['admin'], direct: ['admin'], metagroups: [] }),
    managers: createGroupUsers({ combined: ['manager'], direct: ['manager'], metagroups: [] }),
    analysts: ['analyst1'],
    users: createGroupUsers({ combined: ['testuser'], direct: ['testuser'], metagroups: [] }),
    monitors: createGroupUsers({ combined: [], direct: [], metagroups: [] }),
    description: 'Default test group',
    allowed: createGroupAllowed(),
    ...overrides,
  };
}

// System stats factories
export function createScalerStats(overrides: Partial<ScalerStats> = {}): ScalerStats {
  return {
    deadlines: 5,
    running: 2,
    ...overrides,
  };
}

export function createStats(overrides: Partial<Stats> = {}): Stats {
  const defaultGroups: GroupsStats = {
    default: {
      pipelines: {
        'test-pipeline': {
          stages: {
            'stage-1': {
              testuser: {
                created: 1,
                running: 2,
                completed: 10,
                failed: 1,
                sleeping: 0,
                total: 14,
              },
            },
          },
        },
      },
    },
  };

  return {
    deadlines: 10,
    running: 3,
    users: 5,
    k8s: createScalerStats(),
    baremetal: createScalerStats({ deadlines: 3, running: 1 }),
    external: createScalerStats({ deadlines: 2, running: 0 }),
    groups: defaultGroups,
    ...overrides,
  };
}

// System settings factory
export interface MockSystemSettings {
  [key: string]: string | number | boolean;
}

export function createSystemSettings(overrides: MockSystemSettings = {}): MockSystemSettings {
  return {
    version: '1.0.0',
    environment: 'test',
    debug: false,
    max_file_size: 104857600,
    retention_days: 30,
    ...overrides,
  };
}
