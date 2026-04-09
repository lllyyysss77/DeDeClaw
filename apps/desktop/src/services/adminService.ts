import { API_BASE_URL } from './apiBase';
import { authService } from './authService';
import type { Agent } from '@/shared/types/agent';
import type { AgentFull } from '@/shared/types/agent';
import type {
  AdminUser,
  ApiType,
  CustomParam,
  DashboardPayload,
  LogListFilter,
  LogListPayload,
  ModelProviderConfig,
  SystemConfig,
} from '@/shared/types/admin';

export interface CreateAgentPayload {
  name: string;
  avatar?: string;
  role: string;
  description?: string;
  prompt?: string;
  skills?: string;
  priceRate: number;
  priceUnit: string;
  modelId?: string;
}

export interface UpdateAgentPayload {
  name?: string;
  avatar?: string | null;
  role?: string;
  description?: string | null;
  prompt?: string | null;
  skills?: string | null;
  priceRate?: number;
  priceUnit?: string;
  modelId?: string | null;
}

export interface ApiConfigUpsertPayload {
  customId: string;
  apiType: ApiType;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
  customParams: CustomParam[];
  isEnabled: boolean;
}

interface ApiResponse<TData> {
  isSuccess?: boolean;
  success?: boolean;
  data?: TData;
  error?: string;
  message?: string;
}

interface ApiResult<TData> {
  isSuccess: boolean;
  data?: TData;
  error?: string;
}

const requestJson = async <TData>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<TData>> => {
  try {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as ApiResponse<TData>;
    const ok = payload.isSuccess ?? payload.success ?? response.ok;

    if (!ok) {
      return {
        isSuccess: false,
        error: payload.error ?? payload.message ?? '请求失败',
      };
    }

    return {
      isSuccess: true,
      data: payload.data,
    };
  } catch (error) {
    return {
      isSuccess: false,
      error: error instanceof Error ? error.message : '网络异常',
    };
  }
};

const emptyDashboard: DashboardPayload = {
  users: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  generatedArticles: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  calls: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  tokens: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  successRate: { total: 1, today: 1 },
  callTypeBreakdown: [],
  topTokenUsers: [],
};

export const fetchDashboard = async (): Promise<DashboardPayload> => {
  const result = await requestJson<DashboardPayload>('/admin/dashboard');
  return result.isSuccess && result.data ? result.data : emptyDashboard;
};

export const fetchUsers = async (): Promise<AdminUser[]> => {
  const result = await requestJson<AdminUser[]>('/admin/users');
  return result.isSuccess && result.data ? result.data : [];
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  const result = await requestJson<{ success: boolean }>(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
  return result.isSuccess;
};

export const fetchApiConfigs = async (): Promise<ModelProviderConfig[]> => {
  const result = await requestJson<ModelProviderConfig[]>('/admin/model-configs');
  return result.isSuccess && result.data ? result.data : [];
};

export const fetchEnabledLlmConfigs = async (): Promise<ModelProviderConfig[]> => {
  const configs = await fetchApiConfigs();
  return configs.filter((model) => model.apiType === 'llm' && model.isEnabled);
};

export const fetchAgents = async (): Promise<AgentFull[]> => {
  const result = await requestJson<AgentFull[]>('/admin/agents');
  return result.isSuccess && result.data ? result.data : [];
};

export const fetchListedAgents = async (): Promise<Agent[]> => {
  const result = await requestJson<Agent[]>('/admin/agents/listed');
  return result.isSuccess && result.data ? result.data : [];
};

export const createAgent = async (payload: CreateAgentPayload): Promise<boolean> => {
  const result = await requestJson<AgentFull>('/admin/agents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.isSuccess;
};

export const updateAgent = async (agentId: string, payload: UpdateAgentPayload): Promise<boolean> => {
  const result = await requestJson<AgentFull>(`/admin/agents/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return result.isSuccess;
};

export const deleteAgent = async (agentId: string): Promise<boolean> => {
  const result = await requestJson<{ deleted: boolean }>(`/admin/agents/${agentId}`, {
    method: 'DELETE',
  });
  return result.isSuccess;
};

export const createApiConfig = async (payload: ApiConfigUpsertPayload): Promise<boolean> => {
  const result = await requestJson<ModelProviderConfig>('/admin/model-configs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.isSuccess;
};

export const updateApiConfig = async (
  providerId: string,
  payload: ApiConfigUpsertPayload,
): Promise<boolean> => {
  const result = await requestJson<ModelProviderConfig>(`/admin/model-configs/${providerId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return result.isSuccess;
};

export const deleteApiConfig = async (providerId: string): Promise<boolean> => {
  const result = await requestJson<{ deleted: boolean }>(`/admin/model-configs/${providerId}`, {
    method: 'DELETE',
  });
  return result.isSuccess;
};

export const updateApiConfigEnabled = async (
  config: ModelProviderConfig,
  isEnabled: boolean,
): Promise<boolean> => {
  return updateApiConfig(config.providerId, {
    customId: config.customId,
    apiType: config.apiType,
    baseUrl: config.baseUrl,
    modelName: config.modelName,
    customParams: config.customParams,
    isEnabled,
  });
};

export const fetchSystemConfig = async (): Promise<SystemConfig> => {
  const result = await requestJson<SystemConfig>('/admin/system-config');
  return result.isSuccess && result.data
    ? result.data
    : { electronDataPushIntervalSeconds: 20, websocketHeartbeatSeconds: 30, isMaintenanceMode: false };
};

export const saveSystemConfig = async (payload: SystemConfig): Promise<boolean> => {
  const result = await requestJson<{ updated: boolean }>('/admin/system-config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return result.isSuccess;
};

export const fetchLogs = async (filter?: LogListFilter): Promise<LogListPayload> => {
  const params = new URLSearchParams();
  if (filter?.callType) params.set('callType', filter.callType);
  if (filter?.apiType) params.set('apiType', filter.apiType);
  if (filter?.userId) params.set('userId', filter.userId);
  if (filter?.modelCustomId) params.set('modelCustomId', filter.modelCustomId);
  if (filter?.page) params.set('page', String(filter.page));
  if (filter?.pageSize) params.set('pageSize', String(filter.pageSize));
  const query = params.toString();

  const result = await requestJson<LogListPayload>(`/admin/logs${query ? `?${query}` : ''}`);
  return result.isSuccess && result.data
    ? result.data
    : { list: [], total: 0, page: 1, pageSize: 20 };
};
