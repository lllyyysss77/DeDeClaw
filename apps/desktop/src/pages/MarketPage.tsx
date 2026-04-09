import { useMemo, useState, useEffect } from 'react';
import { Search, Aperture, Pencil, SquareMousePointer, UserPlus, ImagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/Modal';
import {
  createAgent,
  deleteAgent,
  fetchAgents,
  fetchEnabledLlmConfigs,
  updateAgent,
} from '@/services/adminService';
import { channelService } from '../services/channelService';
import type { ModelProviderConfig } from '@/shared/types/admin';
import type { Agent, AgentFull } from '@/shared/types/agent';
import type { ChannelData } from '../shared/types/channel';
import { TALENT_AVATAR_ITEMS } from '../shared/constants/talentAvatar';

interface MarketPageProps {
  isActive?: boolean;
  onOpenTalentChat?: (channel: ChannelData) => void;
}

interface AgentFormState {
  name: string;
  avatar: string;
  role: string;
  description: string;
  prompt: string;
  skills: string;
  modelId: string;
}

interface ImportAgentItem {
  name: string;
  avatar?: string;
  role: string;
  description?: string;
  prompt?: string;
  skills?: string;
}

type MarketModalMode = 'create' | 'edit';
type CreateTab = 'manual' | 'json';

const EMPTY_FORM: AgentFormState = {
  name: '',
  avatar: '',
  role: '',
  description: '',
  prompt: '',
  skills: '',
  modelId: '',
};

const IMPORT_JSON_PLACEHOLDER = `支持单条对象或数组：
{
  "name": "张三",
  "avatar": "可选",
  "role": "前端工程师",
  "description": "可选",
  "prompt": "可选",
  "skills": "可选"
}`;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const parseImportJsonText = (text: string): { items: ImportAgentItem[]; error?: string } => {
  try {
    const parsedJson: unknown = JSON.parse(text);
    const rawItems = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
    const items: ImportAgentItem[] = [];

    for (const [index, item] of rawItems.entries()) {
      if (!isRecord(item)) {
        return { items: [], error: `第 ${index + 1} 条必须是对象` };
      }

      if (typeof item.name !== 'string' || item.name.trim().length === 0) {
        return { items: [], error: `第 ${index + 1} 条缺少 name` };
      }

      if (typeof item.role !== 'string' || item.role.trim().length === 0) {
        return { items: [], error: `第 ${index + 1} 条缺少 role` };
      }

      items.push({
        name: item.name.trim(),
        avatar: typeof item.avatar === 'string' ? item.avatar : undefined,
        role: item.role.trim(),
        description: typeof item.description === 'string' ? item.description : undefined,
        prompt: typeof item.prompt === 'string' ? item.prompt : undefined,
        skills: typeof item.skills === 'string' ? item.skills : undefined,
      });
    }

    return { items };
  } catch {
    return { items: [], error: 'JSON 格式不合法' };
  }
};

function MarketPage({ isActive, onOpenTalentChat }: MarketPageProps) {
  const fallbackAvatarUrl = `${import.meta.env.BASE_URL}dede.webp`;
  const { t } = useTranslation();
  const [agents, setAgents] = useState<AgentFull[]>([]);
  const [models, setModels] = useState<ModelProviderConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [openingChatAgentId, setOpeningChatAgentId] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<MarketModalMode>('create');
  const [createTab, setCreateTab] = useState<CreateTab>('manual');
  const [editingAgent, setEditingAgent] = useState<AgentFull | null>(null);
  const [agentForm, setAgentForm] = useState<AgentFormState>(EMPTY_FORM);
  const [importJsonText, setImportJsonText] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const loadData = async () => {
    const [agentList, llmModels] = await Promise.all([fetchAgents(), fetchEnabledLlmConfigs()]);
    setAgents(agentList);
    setModels(llmModels);
  };

  // 加载 Agent 数据（创建即用）
  useEffect(() => {
    if (isActive) {
      setIsLoading(true);
      loadData().catch(() => {
        window.alert('加载人才失败，请稍后重试');
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive && selectedAgentId !== null) {
      setSelectedAgentId(null);
    }
  }, [isActive, selectedAgentId]);

  const filteredAgents = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    return agents.filter((agent) => {
      return (
        keyword.length === 0 ||
        agent.name.toLowerCase().includes(keyword) ||
        agent.role.toLowerCase().includes(keyword) ||
        (agent.description?.toLowerCase().includes(keyword) ?? false)
      );
    });
  }, [agents, searchQuery]);

  const openCreateModal = () => {
    setModalMode('create');
    setCreateTab('manual');
    setEditingAgent(null);
    setImportJsonText('');
    setIsAvatarPickerOpen(false);
    setAgentForm({
      ...EMPTY_FORM,
      modelId: models[0]?.customId ?? '',
    });
    setIsAgentModalOpen(true);
  };

  const openEditModal = (agent: AgentFull) => {
    setModalMode('edit');
    setCreateTab('manual');
    setEditingAgent(agent);
    setIsAvatarPickerOpen(false);
    setAgentForm({
      name: agent.name,
      avatar: agent.avatar ?? '',
      role: agent.role,
      description: agent.description ?? '',
      prompt: agent.prompt ?? '',
      skills: agent.skills ?? '',
      modelId: agent.modelId ?? '',
    });
    setIsAgentModalOpen(true);
  };

  const handleSubmitManualForm = async () => {
    if (!agentForm.name.trim() || !agentForm.role.trim()) {
      window.alert('请填写昵称和岗位');
      return;
    }

    const payload = {
      name: agentForm.name.trim(),
      avatar: agentForm.avatar.trim() || undefined,
      role: agentForm.role.trim(),
      description: agentForm.description.trim() || undefined,
      prompt: agentForm.prompt.trim() || undefined,
      skills: agentForm.skills.trim() || undefined,
      priceRate: 1,
      priceUnit: 'hour',
      modelId: agentForm.modelId || undefined,
    };

    const isSuccess = modalMode === 'create'
      ? await createAgent(payload)
      : editingAgent
        ? await updateAgent(editingAgent.agentId, payload)
        : false;

    if (!isSuccess) {
      window.alert(modalMode === 'create' ? '创建人才失败' : '更新人才失败');
      return;
    }

    await loadData();
    setIsAgentModalOpen(false);
  };

  const handleImportSubmit = async () => {
    const text = importJsonText.trim();
    if (!text) {
      window.alert('请先粘贴 JSON 数据');
      return;
    }

    const parseResult = parseImportJsonText(text);
    if (parseResult.error) {
      window.alert(parseResult.error);
      return;
    }

    let successCount = 0;
    for (const item of parseResult.items) {
      const isSuccess = await createAgent({
        name: item.name,
        avatar: item.avatar,
        role: item.role,
        description: item.description,
        prompt: item.prompt,
        skills: item.skills,
        priceRate: 1,
        priceUnit: 'hour',
        modelId: models[0]?.customId,
      });
      if (isSuccess) {
        successCount += 1;
      }
    }

    await loadData();
    setImportJsonText('');
    setIsAgentModalOpen(false);
    window.alert(`导入完成：成功 ${successCount} / ${parseResult.items.length}`);
  };

  const toggleSelectAgent = (agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedAgentIds.size === 0) {
      window.alert('请先选择要删除的人才');
      return;
    }

    if (!window.confirm(`确认删除已选中的 ${selectedAgentIds.size} 个人才吗？`)) {
      return;
    }

    for (const agentId of selectedAgentIds) {
      await deleteAgent(agentId);
    }

    setSelectedAgentIds(new Set());
    await loadData();
  };

  const handleOpenTalentChat = async (agent: Agent) => {
    if (openingChatAgentId === agent.agentId) {
      return;
    }

    setOpeningChatAgentId(agent.agentId);
    try {
      const result = await channelService.createChannel(
        [agent.agentId],
        agent.name,
        agent.avatar ?? undefined,
        'hired-talent-chat',
      );

      if (result.success && result.data) {
        onOpenTalentChat?.(result.data);
        return;
      }

      window.alert(result.message ?? '打开会话失败，请稍后重试');
    } catch (error) {
      console.error('[MarketPage] open talent chat failed:', error);
      window.alert('打开会话失败，请稍后重试');
    } finally {
      setOpeningChatAgentId(null);
    }
  };

  // 获取默认头像
  const getAvatarUrl = (agent: Agent): string => {
    if (agent.avatar) return agent.avatar;
    return fallbackAvatarUrl;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F7FA] overflow-hidden">
      {/* 顶部搜索栏 */}
      <div
        className="desktop-topbar px-6 flex items-center justify-between bg-white border-b border-gray-100 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-72 bg-[#F5F7FA] rounded-2xl px-4 py-2.5 flex items-center gap-3 border border-gray-100">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder={t('market.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {isSelectMode && (
            <>
              <button
                onClick={() => {
                  if (selectedAgentIds.size === filteredAgents.length && filteredAgents.length > 0) {
                    setSelectedAgentIds(new Set());
                  } else {
                    setSelectedAgentIds(new Set(filteredAgents.map((a) => a.agentId)));
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {selectedAgentIds.size === filteredAgents.length && filteredAgents.length > 0 ? '取消全选' : '全选'}
              </button>
              <button
                onClick={() => { void handleBatchDelete(); }}
                disabled={selectedAgentIds.size === 0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedAgentIds.size === 0
                    ? 'bg-white text-gray-300 border border-gray-100 cursor-not-allowed'
                    : 'bg-white text-[#7678ee] border border-[#7678ee] hover:bg-[#7678ee]/10'
                }`}
              >
                删除（{selectedAgentIds.size}）
              </button>
            </>
          )}

          <button
            className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
              isSelectMode
                ? 'bg-[#7678ee]/10 text-[#7678ee]'
                : 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => {
              setIsSelectMode((prev) => !prev);
              setSelectedAgentIds(new Set());
            }}
            title="批量选择"
          >
            <SquareMousePointer size={20} />
          </button>

          <button
            className={`w-9 h-9 rounded-lg transition-colors flex items-center justify-center ${
              isSelectMode
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => { if (!isSelectMode) openCreateModal(); }}
            disabled={isSelectMode}
            title="创建人才"
          >
            <UserPlus size={18} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 加载状态 */}
        {isLoading ? (
          <div className="mt-8 text-center text-sm text-gray-400">
            {t('common.loading') || '加载中...'}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {filteredAgents.map((agent) => {
              const isShowingDetail = selectedAgentId === agent.agentId;
              const isSelected = selectedAgentIds.has(agent.agentId);

              return (
                <div
                  key={agent.agentId}
                  onClick={() => {
                    if (isSelectMode) { toggleSelectAgent(agent.agentId); }
                  }}
                  className={`relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                    isSelected ? 'ring-2 ring-[#7678ee]' : ''
                  } ${isSelectMode ? 'cursor-pointer' : ''}`}
                >
                  {isSelectMode && (
                    <div
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelectAgent(agent.agentId);
                      }}
                      className={`absolute top-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center z-10 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#7678ee]'
                          : 'bg-white border-2 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  )}

                  {/* 正常卡片内容 */}
                  <div className={isShowingDetail ? 'pointer-events-none' : ''}>
                  <div className="flex flex-col">
                    {/* 头像 */}
                    <div className="w-full h-0 pb-[100%] relative bg-gray-100">
                      <img
                        src={getAvatarUrl(agent)}
                        alt={agent.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = 'true';
                            img.src = fallbackAvatarUrl;
                          }
                        }}
                      />
                    </div>

                    {/* 信息 */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-semibold text-gray-900">{agent.name}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAgentId(agent.agentId);
                            }}
                            className="hover:text-gray-600 transition-colors"
                            title="查看简介"
                          >
                            <Aperture size={14} className="text-gray-400 flex-shrink-0" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditModal(agent);
                            }}
                            className="hover:text-gray-600 transition-colors"
                            title="编辑"
                          >
                            <Pencil size={14} className="text-gray-400 flex-shrink-0" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 mb-2">{agent.role}</p>

                      <p
                        className="text-xs text-gray-600 mb-2 line-clamp-2 min-h-[28px]"
                        title={agent.description || ''}
                      >
                        {agent.description || '暂无简介'}
                      </p>

                      <button
                        onClick={() => void handleOpenTalentChat(agent)}
                        disabled={openingChatAgentId === agent.agentId}
                        className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        发起对话
                      </button>
                    </div>
                  </div>
                  </div>

                  {/* 详情覆盖层 */}
                  <div
                    className={`absolute inset-0 bg-white/70 backdrop-blur-xl backdrop-saturate-125 border border-white/80 shadow-lg flex flex-col overflow-hidden rounded-xl transition-all duration-200 ease-out ${
                      isShowingDetail
                        ? 'opacity-100 scale-100 pointer-events-auto'
                        : 'opacity-0 scale-[0.98] pointer-events-none'
                    }`}
                  >
                    <div className="flex-1 p-4 overflow-hidden">
                      <h3 className="text-base font-semibold text-gray-900 mb-3">
                        {t('market.profile')}
                      </h3>
                      <div className="text-sm text-gray-700 leading-relaxed line-clamp-[14]">
                        {agent.description || '暂无简介'}
                      </div>
                    </div>
                    <div className="px-3 pb-3 flex-shrink-0">
                      <button
                        onClick={() => setSelectedAgentId(null)}
                        className="w-full py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path
                            d="M10 12L6 8L10 4"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {t('common.back')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredAgents.length === 0 && !isLoading && (
          <div className="mt-8 text-center text-sm text-gray-400">
            {t('market.noMatchedAgents')}
          </div>
        )}
      </div>

      <Modal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        title={modalMode === 'create' ? '创建人才' : '编辑人才'}
        onConfirm={() => {
          if (modalMode === 'create' && createTab === 'json') {
            void handleImportSubmit();
            return;
          }

          void handleSubmitManualForm();
        }}
        confirmText={modalMode === 'create' && createTab === 'json' ? '导入' : '保存'}
        maxWidth="max-w-2xl"
      >
        {modalMode === 'create' && (
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs ${createTab === 'manual' ? 'bg-[#2C2D33] text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setCreateTab('manual')}
            >
              手动创建
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs ${createTab === 'json' ? 'bg-[#2C2D33] text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => setCreateTab('json')}
            >
              JSON 导入
            </button>
          </div>
        )}

        <div className="h-[460px]">
          {modalMode === 'create' && createTab === 'json' ? (
            <textarea
              value={importJsonText}
              onChange={(event) => setImportJsonText(event.target.value)}
              className="w-full h-full rounded-lg border border-gray-200 p-3 text-xs text-gray-700 resize-none"
              placeholder={IMPORT_JSON_PLACEHOLDER}
            />
          ) : (
          <div className="grid gap-3 pb-3">
              <div className="grid gap-2">
                <span className="text-xs text-gray-500">头像</span>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                    <img
                      src={agentForm.avatar || fallbackAvatarUrl}
                      alt={agentForm.name || 'avatar'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAvatarPickerOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <ImagePlus size={14} />
                    选择头像
                  </button>
                </div>
                {isAvatarPickerOpen && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    {TALENT_AVATAR_ITEMS.length === 0 ? (
                      <p className="text-xs text-gray-500">暂无可用头像素材，请检查 talent_icon 目录</p>
                    ) : (
                      <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1">
                        {TALENT_AVATAR_ITEMS.map((option) => {
                          const isSelected = agentForm.avatar === option.avatarUrl;
                          return (
                            <button
                              key={option.fileName}
                              type="button"
                              onClick={() => setAgentForm((prev) => ({ ...prev, avatar: option.avatarUrl }))}
                              className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${
                                isSelected ? 'border-[#7678ee]' : 'border-gray-200 hover:border-gray-300'
                              }`}
                              title={option.fileName}
                            >
                              <img src={option.avatarUrl} alt={option.fileName} className="w-full h-full object-cover" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <label className="grid gap-1 text-xs text-gray-500">
                昵称 *
                <input
                  value={agentForm.name}
                  onChange={(event) => setAgentForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
              </label>
              <label className="grid gap-1 text-xs text-gray-500">
                岗位 *
                <input
                  value={agentForm.role}
                  onChange={(event) => setAgentForm((prev) => ({ ...prev, role: event.target.value }))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
              </label>
              <label className="grid gap-1 text-xs text-gray-500">
                简介
                <textarea
                  value={agentForm.description}
                  onChange={(event) => setAgentForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={2}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
              </label>
              <label className="grid gap-1 text-xs text-gray-500">
                提示词
                <textarea
                  value={agentForm.prompt}
                  onChange={(event) => setAgentForm((prev) => ({ ...prev, prompt: event.target.value }))}
                  rows={4}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
              </label>
              <label className="grid gap-1 text-xs text-gray-500">
                技能
                <textarea
                  value={agentForm.skills}
                  onChange={(event) => setAgentForm((prev) => ({ ...prev, skills: event.target.value }))}
                  rows={4}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
              </label>
              <label className="grid gap-1 text-xs text-gray-500">
                模型
                <select
                  value={agentForm.modelId}
                  onChange={(event) => setAgentForm((prev) => ({ ...prev, modelId: event.target.value }))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                >
                  <option value="">不绑定模型</option>
                  {models.map((model) => (
                    <option key={model.providerId} value={model.customId}>{model.customId}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}

export default MarketPage;
