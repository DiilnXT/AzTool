'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { DeQLogo } from '@/components/DeQLogo';
import { getAvailableKeys, callGeminiApi, POPULAR_GEMINI_MODELS, DEFAULT_MODEL_ID } from '@/lib/gemini';
import {
  X,
  Key,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Cpu,
  Check,
  User,
  Sun,
  Moon,
  Palette,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    user,
    systemConfig,
    theme,
    setTheme,
    updateDisplayName,
    saveUserApiKey,
    saveUserGeminiModel,
    updateSystemConfig,
    isSuperAdmin,
  } = useAuth();
  const toast = useToast();

  const [displayNameInput, setDisplayNameInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelIdInput, setModelIdInput] = useState(DEFAULT_MODEL_ID);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user?.displayName) {
      setDisplayNameInput(user.displayName);
    } else {
      setDisplayNameInput('');
    }

    if (isSuperAdmin) {
      if (user?.customApiKey) {
        setApiKeyInput(user.customApiKey);
      } else if (systemConfig.defaultGeminiApiKey) {
        setApiKeyInput(systemConfig.defaultGeminiApiKey);
      }

      if (user?.customModelId) {
        setModelIdInput(user.customModelId);
      } else if (systemConfig.defaultGeminiModel) {
        setModelIdInput(systemConfig.defaultGeminiModel);
      }
    }
  }, [user, systemConfig, isSuperAdmin, isOpen]);

  if (!isOpen || !mounted) return null;

  const detectedKeys = getAvailableKeys(apiKeyInput);

  const handleSave = () => {
    if (user && displayNameInput.trim()) {
      updateDisplayName(displayNameInput.trim());
    }

    if (isSuperAdmin) {
      const trimmedModel = modelIdInput.trim() || DEFAULT_MODEL_ID;
      const trimmedKeys = apiKeyInput.trim();

      saveUserApiKey(trimmedKeys);
      saveUserGeminiModel(trimmedModel);

      updateSystemConfig({
        defaultGeminiApiKey: trimmedKeys,
        defaultGeminiModel: trimmedModel,
      });

      toast.success(
        'Đã lưu cấu hình Quản trị & Cá nhân!',
        `Model: ${trimmedModel} • ${detectedKeys.length} API Key hoạt động.`
      );
    } else {
      toast.success(
        'Đã lưu tùy chỉnh cá nhân!',
        `Tên hiển thị và chế độ giao diện (${theme === 'dark' ? 'Tối' : 'Sáng'}) đã được cập nhật.`
      );
    }

    confetti({ particleCount: 30, spread: 45 });
    onClose();
  };

  const handleTestConnection = async () => {
    if (!isSuperAdmin) return;
    if (detectedKeys.length === 0) {
      setTestingStatus('error');
      setTestMessage('Vui lòng nhập ít nhất 1 API key Gemini hợp lệ.');
      return;
    }

    setTestingStatus('testing');
    setTestMessage(`Đang kiểm tra kết nối với Model [${modelIdInput}]...`);

    try {
      const response = await callGeminiApi(
        'Trả lời ngắn gọn "OK" để xác nhận kết nối.',
        apiKeyInput,
        modelIdInput
      );
      setTestingStatus('success');
      setTestMessage(`Thành công! Phản hồi: "${response.trim()}"`);
    } catch (err: any) {
      setTestingStatus('error');
      setTestMessage(`Thất bại: ${err.message}`);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm modal-backdrop-enter"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md canva-card rounded-3xl p-6 shadow-2xl space-y-5 modal-card-enter border border-purple-100 dark:border-purple-900/50 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl canva-gradient-bg text-white flex items-center justify-center shadow-xs">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight text-neutral-900 dark:text-neutral-100">
                Tùy Chỉnh Tài Khoản &amp; Giao Diện
              </h3>
              <p className="text-[11px] text-neutral-500">
                Cá nhân hóa hiển thị và chế độ màu sắc Sáng / Tối
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition canva-tap"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* 1. DISPLAY NAME (Available to all users) */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#7d2ae8]" />
              <span>Tên hiển thị của bạn:</span>
            </label>
            <input
              type="text"
              value={displayNameInput}
              onChange={e => setDisplayNameInput(e.target.value)}
              placeholder="Nhập tên hiển thị..."
              className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-[#7d2ae8] outline-hidden shadow-xs transition"
            />
            {user?.email && (
              <p className="text-[11px] text-neutral-400">
                Tài khoản đang đăng nhập: <span className="font-medium text-neutral-600 dark:text-neutral-300">{user.email}</span>
              </p>
            )}
          </div>

          {/* 2. THEME SWITCHER: LIGHT / DARK MODE (Available to all users) */}
          <div className="space-y-2 pt-1">
            <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Chế độ màu giao diện (Sáng / Tối):</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3.5 rounded-2xl border flex items-center gap-2.5 transition canva-tap ${
                  theme === 'light'
                    ? 'border-[#7d2ae8] bg-purple-50/70 dark:bg-purple-950/40 text-[#7d2ae8] font-bold shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-purple-200'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">Giao Diện Sáng</div>
                  <div className="text-[10px] opacity-75">Trắng tinh tế</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3.5 rounded-2xl border flex items-center gap-2.5 transition canva-tap ${
                  theme === 'dark'
                    ? 'border-[#7d2ae8] bg-purple-950/50 text-purple-300 font-bold shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-purple-200'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-cyan-400 flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold">Giao Diện Tối</div>
                  <div className="text-[10px] opacity-75">Dịu mắt ban đêm</div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. ADMIN-ONLY AI ENGINE SETTINGS (Google OAuth Key is permanently vaulted & hidden!) */}
          {isSuperAdmin && (
            <div className="space-y-4 pt-4 mt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                <Cpu className="w-3 h-3" />
                <span>Cấu Hình AI Dành Riêng Cho Quản Trị Viên</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#7d2ae8]" />
                    <span>Model ID Gemini Hệ Thống:</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={modelIdInput}
                  onChange={e => {
                    setModelIdInput(e.target.value);
                    setTestingStatus('idle');
                  }}
                  placeholder="gemini-2.0-flash, gemini-1.5-flash..."
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs font-bold focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
                />

                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_GEMINI_MODELS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModelIdInput(m.id);
                        setTestingStatus('idle');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition canva-tap border ${
                        modelIdInput === m.id
                          ? 'bg-[#7d2ae8] text-white border-transparent'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700'
                      }`}
                    >
                      {m.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>Gemini API Keys (Cách nhau dấu phẩy):</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600">
                    {detectedKeys.length} key
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={apiKeyInput}
                  onChange={e => {
                    setApiKeyInput(e.target.value);
                    setTestingStatus('idle');
                  }}
                  placeholder="AIzaSyA..., AIzaSyB..."
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden"
                />
              </div>

              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingStatus === 'testing' || !apiKeyInput.trim()}
                    className="canva-btn-secondary px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testingStatus === 'testing' ? (
                      <DeQLogo size="xs" showSubtitle={false} isLoadingMode />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#7d2ae8]" />
                    )}
                    <span>{testingStatus === 'testing' ? 'Đang kiểm tra...' : 'Test API Key'}</span>
                  </button>
                  {testingStatus === 'success' && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> OK
                    </span>
                  )}
                  {testingStatus === 'error' && (
                    <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Lỗi
                    </span>
                  )}
                </div>
                {testMessage && (
                  <p className="text-[10px] text-neutral-500 font-mono break-all">{testMessage}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="canva-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold transition canva-tap"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="canva-btn-primary px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition canva-tap flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Lưu Thay Đổi</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
