export type ApiType = 'llm' | 'image' | 'video' | 'vector';

export type CallType = 'chat' | 'plan' | 'rag_embed' | 'memory';

interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  type: string;
  role: string;
}

export interface AdminUser {
  id: string;
  userId: string;
  email: string;
  username: string;
  avatar?: string | null;
  signature?: string | null;
  createdAt: string;
  updatedAt: string;
  workspaces: WorkspaceSummary[];
}

export interface CustomParam {
  key: string;
  value: string;
}

export interface ModelProviderConfig {
  providerId: string;
  customId: string;
  apiType: ApiType;
  baseUrl: string;
  modelName: string;
  apiKeyMasked: string;
  customParams: CustomParam[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemConfig {
  electronDataPushIntervalSeconds: number;
  websocketHeartbeatSeconds: number;
  isMaintenanceMode: boolean;
}

interface DashboardStat {
  total: number;
  today: number;
  yesterday: number;
  lastWeek: number;
}

export interface CallTypeBreakdown {
  callType: CallType;
  count: number;
}

export interface TopTokenUser {
  userId: string;
  username: string;
  userEmail: string;
  totalTokens: number;
}

export interface DashboardPayload {
  users: DashboardStat;
  generatedArticles: DashboardStat;
  calls: DashboardStat;
  tokens: DashboardStat;
  successRate: { total: number; today: number };
  callTypeBreakdown: CallTypeBreakdown[];
  topTokenUsers: TopTokenUser[];
}

export interface LogRecord {
  id: string;
  modelCustomId: string;
  apiType: ApiType;
  callType: CallType;
  userId: string | null;
  userEmail: string | null;
  username: string | null;
  channelId: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
  isSuccess: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface LogListFilter {
  callType?: CallType;
  apiType?: ApiType;
  userId?: string;
  modelCustomId?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedPayload<TItem> {
  list: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LogListPayload extends PagedPayload<LogRecord> {}
