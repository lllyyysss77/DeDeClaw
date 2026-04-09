import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import Toggle from '@/components/Toggle';
import {
  createApiConfig,
  deleteApiConfig,
  deleteUser,
  fetchApiConfigs,
  fetchDashboard,
  fetchLogs,
  fetchSystemConfig,
  fetchUsers,
  saveSystemConfig,
  updateApiConfig,
  type ApiConfigUpsertPayload,
} from '@/services/adminService';
import type {
  AdminUser,
  ApiType,
  CallType,
  CustomParam,
  DashboardPayload,
  LogListFilter,
  LogRecord,
  ModelProviderConfig,
  SystemConfig,
} from '@/shared/types/admin';

export type SettingsAdminSection =
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-api'
  | 'admin-system'
  | 'admin-logs';

type FeedbackType = 'success' | 'error';
type FeedbackHandler = (message: string, type: FeedbackType) => void;

interface DesktopAdminModulesProps {
  section: SettingsAdminSection;
  onFeedback: FeedbackHandler;
}

interface ApiFormData {
  customId: string;
  apiType: ApiType;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  customParams: CustomParam[];
  isEnabled: boolean;
}

const apiTypeLabels: Record<ApiType, string> = {
  llm: 'LLM',
  image: '图片',
  video: '视频',
  vector: '向量',
};

const CALL_TYPE_LABELS: Record<CallType, string> = {
  chat: '普通聊天',
  plan: '计划模式',
  rag_embed: 'RAG 向量化',
  memory: '记忆提取',
};

const API_TYPE_LABELS: Record<ApiType, string> = {
  llm: 'LLM 大语言模型',
  image: '图片生成',
  video: '视频生成',
  vector: '向量嵌入',
};

const PIE_COLORS = ['#111827', '#6b7280', '#9ca3af', '#d1d5db'];
const PAGE_SIZE = 20;

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function buildApiFormData(mode: 'create' | 'edit', initialData?: ModelProviderConfig | null): ApiFormData {
  if (mode === 'create') {
    return {
      customId: '',
      apiType: 'llm',
      baseUrl: '',
      modelName: '',
      apiKey: '',
      customParams: [],
      isEnabled: true,
    };
  }

  return {
    customId: initialData?.customId ?? '',
    apiType: initialData?.apiType ?? 'llm',
    baseUrl: initialData?.baseUrl ?? '',
    modelName: initialData?.modelName ?? '',
    apiKey: '',
    customParams: initialData?.customParams ?? [],
    isEnabled: initialData?.isEnabled ?? true,
  };
}

function ApiFormModal({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: ModelProviderConfig | null;
  onClose: () => void;
  onSubmit: (form: ApiFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<ApiFormData>(buildApiFormData(mode, initialData));

  useEffect(() => {
    if (isOpen) {
      setForm(buildApiFormData(mode, initialData));
    }
  }, [isOpen, mode, initialData]);

  const handleAddParam = () => {
    setForm((prev) => ({ ...prev, customParams: [...prev.customParams, { key: '', value: '' }] }));
  };

  const handleParamChange = (index: number, field: 'key' | 'value', value: string) => {
    setForm((prev) => ({
      ...prev,
      customParams: prev.customParams.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const handleRemoveParam = (index: number) => {
    setForm((prev) => ({
      ...prev,
      customParams: prev.customParams.filter((_, i) => i !== index),
    }));
  };

  const handleConfirm = async () => {
    if (!form.customId.trim() || !form.baseUrl.trim() || !form.modelName.trim()) {
      return;
    }
    if (mode === 'create' && !form.apiKey.trim()) {
      return;
    }
    await onSubmit(form);
  };

  const inputStyle: React.CSSProperties = {
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '9px 10px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle };
  const labelStyle: React.CSSProperties = { fontSize: 13, color: '#374151' };
  const noteStyle: React.CSSProperties = { margin: 0, color: '#6b7280', fontSize: 12 };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? '创建新 API' : '编辑 API 配置'}
      onConfirm={() => {
        void handleConfirm();
      }}
      confirmText={mode === 'create' ? '创建' : '保存'}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 8 }}>
          <span style={labelStyle}>自定义 ID *</span>
          <input
            style={inputStyle}
            value={form.customId}
            onChange={(e) => setForm((prev) => ({ ...prev, customId: e.target.value }))}
            placeholder="例如：openai-gpt4、claude-sonnet"
            autoComplete="off"
          />
          <p style={noteStyle}>前端调用时用于识别此模型的唯一标识</p>
        </label>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={labelStyle}>API 类型 *</span>
          <select
            style={selectStyle}
            value={form.apiType}
            onChange={(e) => setForm((prev) => ({ ...prev, apiType: e.target.value as ApiType }))}
          >
            <option value="llm">LLM 大语言模型</option>
            <option value="image">图片生成</option>
            <option value="video">视频生成</option>
            <option value="vector">向量嵌入</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={labelStyle}>Base URL *</span>
          <input
            style={inputStyle}
            value={form.baseUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
            placeholder="https://api.openai.com/v1"
            autoComplete="off"
          />
        </label>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={labelStyle}>模型名称 *</span>
          <input
            style={inputStyle}
            value={form.modelName}
            onChange={(e) => setForm((prev) => ({ ...prev, modelName: e.target.value }))}
            placeholder="gpt-4.1-mini"
            autoComplete="off"
          />
        </label>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={labelStyle}>API Key {mode === 'edit' && '（留空则不修改）'}</span>
          <input
            style={inputStyle}
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={mode === 'create' ? '必填' : '●●●●●●●● 已有密钥，输入将覆盖'}
            autoComplete="new-password"
          />
        </label>

        <div style={{ display: 'grid', gap: 8 }}>
          <div className="flex items-center justify-between mb-2">
            <span style={labelStyle}>自定义参数</span>
            <button
              type="button"
              onClick={handleAddParam}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Plus size={14} />
              添加参数
            </button>
          </div>

          {form.customParams.length === 0 ? (
            <p style={noteStyle}>暂无自定义参数</p>
          ) : (
            <div className="space-y-2">
              {form.customParams.map((param, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    style={{ ...inputStyle, flex: 1, width: 'auto' }}
                    value={param.key}
                    onChange={(e) => handleParamChange(index, 'key', e.target.value)}
                    placeholder="参数名"
                  />
                  <input
                    style={{ ...inputStyle, flex: 1, width: 'auto' }}
                    value={param.value}
                    onChange={(e) => handleParamChange(index, 'value', e.target.value)}
                    placeholder="参数值"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveParam(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div className="flex items-center justify-between">
            <span style={labelStyle}>启用状态</span>
            <Toggle checked={form.isEnabled} onChange={(checked) => setForm((prev) => ({ ...prev, isEnabled: checked }))} />
          </div>
          <p style={noteStyle}>{form.isEnabled ? '当前已启用' : '当前已停用'}</p>
        </div>
      </div>
    </Modal>
  );
}

function PieChart({ data }: { data: DashboardPayload['callTypeBreakdown'] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>暂无数据</p>;
  }

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;
  const innerR = 28;

  let cumAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const path = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    return { item: d, color: PIE_COLORS[i % PIE_COLORS.length], path };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill="#6b7280">总计</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={13} fontWeight="700" fill="#111827">
          {formatNum(total)}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: '#374151' }}>{CALL_TYPE_LABELS[s.item.callType] ?? s.item.callType}</span>
            <span style={{ color: '#9ca3af', marginLeft: 'auto', paddingLeft: 8 }}>
              {formatNum(s.item.count)} ({((s.item.count / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenRankTable({ users }: { users: DashboardPayload['topTokenUsers'] }) {
  if (users.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>暂无数据</p>;
  }
  const max = users[0].totalTokens;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {users.map((u, i) => (
        <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 18, fontSize: 11, color: i < 3 ? '#111827' : '#9ca3af', fontWeight: i < 3 ? 700 : 400, textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.username || u.userEmail || u.userId}
                {u.username && u.userEmail && (
                  <span style={{ color: '#9ca3af', marginLeft: 4 }}>({u.userEmail})</span>
                )}
              </span>
              <span style={{ fontSize: 12, color: '#111827', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                {formatNum(u.totalTokens)}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(u.totalTokens / max) * 100}%`, background: '#111827', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface CompareRowProps {
  label: string;
  value: number;
  today: number;
  yesterday: number;
  lastWeek: number;
  formatter?: (n: number) => string;
}

function CompareRow({ label, value, today, yesterday, lastWeek, formatter = formatNum }: CompareRowProps) {
  return (
    <article style={{ borderRadius: 14, background: '#ffffff', padding: 14 }}>
      <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: '#111827' }}>{formatter(value)}</p>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>今日 {formatter(today)}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>昨日 {formatter(yesterday)}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>上周 {formatter(lastWeek)}</span>
      </div>
    </article>
  );
}

const emptyPayload: DashboardPayload = {
  users: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  generatedArticles: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  calls: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  tokens: { total: 0, today: 0, yesterday: 0, lastWeek: 0 },
  successRate: { total: 1, today: 1 },
  callTypeBreakdown: [],
  topTokenUsers: [],
};

function AdminDashboardModule() {
  const [data, setData] = useState<DashboardPayload>(emptyPayload);

  useEffect(() => {
    fetchDashboard().then(setData);
  }, []);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <CompareRow
          label="总用户数"
          value={data.users.total}
          today={data.users.today}
          yesterday={data.users.yesterday}
          lastWeek={data.users.lastWeek}
        />
        <CompareRow
          label="生成文章数量"
          value={data.generatedArticles.total}
          today={data.generatedArticles.today}
          yesterday={data.generatedArticles.yesterday}
          lastWeek={data.generatedArticles.lastWeek}
        />
        <CompareRow
          label="API 调用次数"
          value={data.calls.total}
          today={data.calls.today}
          yesterday={data.calls.yesterday}
          lastWeek={data.calls.lastWeek}
        />
        <CompareRow
          label="总消耗 Token"
          value={data.tokens.total}
          today={data.tokens.today}
          yesterday={data.tokens.yesterday}
          lastWeek={data.tokens.lastWeek}
        />
        <article style={{ borderRadius: 14, background: '#ffffff', padding: 14 }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>成功率</p>
          <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: '#111827' }}>{formatPct(data.successRate.total)}</p>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>今日 {formatPct(data.successRate.today)}</span>
          </div>
        </article>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">调用场景占比</h3>
          <PieChart data={data.callTypeBreakdown} />
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">用户 Token 消耗排名 Top 10</h3>
          <TokenRankTable users={data.topTokenUsers} />
        </div>
      </div>
    </div>
  );
}

function AdminUsersModule({ onFeedback }: { onFeedback: FeedbackHandler }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setUsers(await fetchUsers());
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await deleteUser(deleteTarget.userId);
    if (!success) {
      onFeedback('删除失败，请稍后重试', 'error');
      return;
    }
    setDeleteTarget(null);
    await loadUsers();
    onFeedback('用户已删除', 'success');
  };

  if (loading) return <div className="rounded-xl bg-white p-6 text-sm text-gray-400">加载中...</div>;

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 text-left text-xs text-gray-500">用户 ID</th>
            <th className="px-4 py-3 text-left text-xs text-gray-500">用户名</th>
            <th className="px-4 py-3 text-left text-xs text-gray-500">邮箱</th>
            <th className="px-4 py-3 text-left text-xs text-gray-500">注册时间</th>
            <th className="px-4 py-3 text-left text-xs text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.userId} className="border-b border-gray-100">
              <td className="px-4 py-3 text-sm text-gray-700">{user.userId}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{user.username}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{user.email}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{new Date(user.createdAt).toLocaleDateString('zh-CN')}</td>
              <td className="px-4 py-3 text-sm">
                <button onClick={() => setDeleteTarget(user)} className="text-xs text-red-600 hover:text-red-800">删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="确认删除用户"
        onConfirm={() => {
          void confirmDelete();
        }}
        confirmText="删除"
        cancelText="取消"
        confirmButtonVariant="danger"
      >
        <p className="text-sm text-gray-600">确定删除 <strong>{deleteTarget?.username}</strong> 吗？</p>
      </Modal>
    </div>
  );
}

function AdminApiModule({ onFeedback }: { onFeedback: FeedbackHandler }) {
  const [configs, setConfigs] = useState<ModelProviderConfig[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingConfig, setEditingConfig] = useState<ModelProviderConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelProviderConfig | null>(null);

  const loadConfigs = useCallback(async () => {
    setConfigs(await fetchApiConfigs());
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const handleSubmit = async (form: ApiFormData) => {
    const payload: ApiConfigUpsertPayload = {
      customId: form.customId,
      apiType: form.apiType,
      baseUrl: form.baseUrl,
      modelName: form.modelName,
      customParams: form.customParams,
      isEnabled: form.isEnabled,
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
    };

    const success = mode === 'create'
      ? await createApiConfig(payload)
      : editingConfig
        ? await updateApiConfig(editingConfig.providerId, payload)
        : false;

    if (!success) {
      onFeedback(mode === 'create' ? '创建失败' : '更新失败', 'error');
      return;
    }

    setIsModalOpen(false);
    await loadConfigs();
    onFeedback(mode === 'create' ? 'API 配置创建成功' : 'API 配置更新成功', 'success');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const success = await deleteApiConfig(deleteTarget.providerId);
    if (!success) {
      onFeedback('删除失败，请稍后重试', 'error');
      return;
    }
    setDeleteTarget(null);
    await loadConfigs();
    onFeedback('API 配置已删除', 'success');
  };

  const handleToggle = async (config: ModelProviderConfig) => {
    const success = await updateApiConfig(config.providerId, {
      customId: config.customId,
      apiType: config.apiType,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      customParams: config.customParams,
      isEnabled: !config.isEnabled,
    });

    if (!success) {
      onFeedback('状态更新失败', 'error');
      return;
    }

    setConfigs((prev) => prev.map((item) => (
      item.providerId === config.providerId ? { ...item, isEnabled: !item.isEnabled } : item
    )));
  };

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setEditingConfig(null);
            setMode('create');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#2C2D33] text-white rounded-lg text-sm font-medium hover:bg-[#1a1b1f] transition-colors"
        >
          <Plus size={16} />
          创建新 API
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs text-gray-600 py-3 px-3">自定义 ID</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">类型</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">模型</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">更新时间</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">启用</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {configs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                  暂无 API 配置，点击上方按钮创建
                </td>
              </tr>
            ) : (
              configs.map((config) => (
                <tr key={config.providerId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 text-sm text-gray-700">{config.customId}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{apiTypeLabels[config.apiType]}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{config.modelName}</td>
                  <td className="py-3 px-3 text-sm text-gray-700">{config.updatedAt}</td>
                  <td className="py-3 px-3"><Toggle checked={config.isEnabled} onChange={() => { void handleToggle(config); }} /></td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('edit');
                          setEditingConfig(config);
                          setIsModalOpen(true);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        编辑
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(config)} className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1">
                        <Trash2 size={12} />删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ApiFormModal
        isOpen={isModalOpen}
        mode={mode}
        initialData={editingConfig}
        onClose={() => {
          setIsModalOpen(false);
          setEditingConfig(null);
        }}
        onSubmit={handleSubmit}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="确认删除 API 配置"
        onConfirm={() => {
          void handleDelete();
        }}
        confirmText="删除"
        cancelText="取消"
        confirmButtonVariant="danger"
      >
        <p className="text-sm text-gray-600">确定删除 <strong>{deleteTarget?.customId}</strong> 吗？</p>
      </Modal>
    </div>
  );
}

function AdminSystemModule({ onFeedback }: { onFeedback: FeedbackHandler }) {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSystemConfig().then(setConfig);
  }, []);

  const handleSave = async () => {
    if (!config) {
      return;
    }

    setIsSaving(true);
    const success = await saveSystemConfig(config);
    setIsSaving(false);

    if (!success) {
      onFeedback('系统配置保存失败，请稍后重试', 'error');
      return;
    }

    onFeedback('系统配置已更新', 'success');
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm text-gray-600">
          Electron 数据同步间隔（秒）
          <input
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            type="number"
            min={5}
            value={config?.electronDataPushIntervalSeconds ?? 20}
            onChange={(event) =>
              setConfig((previous) =>
                previous
                  ? {
                      ...previous,
                      electronDataPushIntervalSeconds: Number(event.target.value),
                    }
                  : previous
              )
            }
          />
        </label>

        <label className="text-sm text-gray-600">
          WebSocket 心跳间隔（秒）
          <input
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            type="number"
            min={5}
            value={config?.websocketHeartbeatSeconds ?? 30}
            onChange={(event) =>
              setConfig((previous) =>
                previous
                  ? {
                      ...previous,
                      websocketHeartbeatSeconds: Number(event.target.value),
                    }
                  : previous
              )
            }
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-gray-600">
        维护模式
        <select
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={config?.isMaintenanceMode ? 'on' : 'off'}
          onChange={(event) =>
            setConfig((previous) =>
              previous
                ? {
                    ...previous,
                    isMaintenanceMode: event.target.value === 'on',
                  }
                : previous
            )
          }
        >
          <option value="off">关闭</option>
          <option value="on">开启</option>
        </select>
      </label>

      <button
        type="button"
        className="mt-5 rounded-lg bg-[#2C2D33] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1b1f] disabled:opacity-50"
        onClick={() => {
          void handleSave();
        }}
        disabled={isSaving || !config}
      >
        {isSaving ? '保存中...' : '保存配置'}
      </button>
    </div>
  );
}

function AdminLogsModule() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterCallType, setFilterCallType] = useState<CallType | ''>('');
  const [filterApiType, setFilterApiType] = useState<ApiType | ''>('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterModelId, setFilterModelId] = useState('');

  const load = useCallback(async (p: number, filter: LogListFilter) => {
    setLoading(true);
    try {
      const payload = await fetchLogs({ ...filter, page: p, pageSize: PAGE_SIZE });
      setLogs(payload.list);
      setTotal(payload.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const filter: LogListFilter = {};
    if (filterCallType) filter.callType = filterCallType;
    if (filterApiType) filter.apiType = filterApiType;
    if (filterUserId.trim()) filter.userId = filterUserId.trim();
    if (filterModelId.trim()) filter.modelCustomId = filterModelId.trim();
    void load(page, filter);
  }, [filterCallType, filterApiType, filterModelId, filterUserId, load, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
          调用场景
          <select
            value={filterCallType}
            onChange={(e) => { setFilterCallType(e.target.value as CallType | ''); setPage(1); }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', minWidth: '120px' }}
          >
            <option value="">全部</option>
            {(Object.entries(CALL_TYPE_LABELS) as [CallType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
          API 类型
          <select
            value={filterApiType}
            onChange={(e) => { setFilterApiType(e.target.value as ApiType | ''); setPage(1); }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', minWidth: '130px' }}
          >
            <option value="">全部</option>
            {(Object.entries(API_TYPE_LABELS) as [ApiType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
          用户 ID
          <input
            type="text"
            value={filterUserId}
            placeholder="输入用户 ID"
            onChange={(e) => { setFilterUserId(e.target.value); setPage(1); }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', width: '160px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85em', color: '#666' }}>
          API 自定义 ID
          <input
            type="text"
            value={filterModelId}
            placeholder="输入 API ID"
            onChange={(e) => { setFilterModelId(e.target.value); setPage(1); }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.9em', width: '160px' }}
          />
        </label>

        <span style={{ marginLeft: 'auto', fontSize: '0.85em', color: '#999', alignSelf: 'center' }}>
          共 {total.toLocaleString()} 条
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs text-gray-600 py-3 px-3">时间</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">API ID</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">API 类型</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">调用场景</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">用户</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">Token 消耗</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">耗时</th>
              <th className="text-left text-xs text-gray-600 py-3 px-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3 text-sm text-gray-700">{new Date(item.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                <td className="py-3 px-3 text-sm text-gray-700" style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{item.modelCustomId}</td>
                <td className="py-3 px-3 text-sm text-gray-700">{API_TYPE_LABELS[item.apiType] ?? item.apiType}</td>
                <td className="py-3 px-3 text-sm text-gray-700">{CALL_TYPE_LABELS[item.callType] ?? item.callType}</td>
                <td className="py-3 px-3 text-sm text-gray-700">{item.username || item.userEmail ? `${item.username ?? ''}${item.userEmail ? ` (${item.userEmail})` : ''}` : item.userId ?? '系统'}</td>
                <td className="py-3 px-3 text-sm text-gray-700">{item.totalTokens != null ? <span title={`输入 ${item.promptTokens ?? '-'} / 输出 ${item.completionTokens ?? '-'}`}>{item.totalTokens.toLocaleString()}</span> : <span style={{ color: '#999' }}>—</span>}</td>
                <td className="py-3 px-3 text-sm text-gray-700">{item.durationMs} ms</td>
                <td className="py-3 px-3 text-sm">
                  {item.isSuccess ? <span style={{ color: '#22c55e', fontWeight: 600 }}>成功</span> : <span style={{ color: '#ef4444', fontWeight: 600 }} title={item.errorMessage ?? ''}>失败</span>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">{loading ? '加载中…' : '暂无日志'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
          >
            上一页
          </button>
          <span style={{ fontSize: '0.9em', color: '#666' }}>{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

export default function DesktopAdminModules({ section, onFeedback }: DesktopAdminModulesProps) {
  if (section === 'admin-dashboard') return <AdminDashboardModule />;
  if (section === 'admin-users') return <AdminUsersModule onFeedback={onFeedback} />;
  if (section === 'admin-api') return <AdminApiModule onFeedback={onFeedback} />;
  if (section === 'admin-system') return <AdminSystemModule onFeedback={onFeedback} />;
  return <AdminLogsModule />;
}
