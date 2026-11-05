'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ToastProvider';
import { getAvailableKeys, callGeminiApi, POPULAR_GEMINI_MODELS, DEFAULT_MODEL_ID } from '@/lib/gemini';
import {
  X,
  Key,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Cpu,
  RefreshCw,
  Check,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, systemConfig, saveUserApiKey, saveUserGeminiModel, updateSystemConfig, isSuperAdmin } = useAuth();
  const toast = useToast();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelIdInput, setModelIdInput] = useState(DEFAULT_MODEL_ID);
  const [googleClientIdInput, setGoogleClientIdInput] = useState('');
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [universityInput, setUniversityInput] = useState('TRƯỜNG ĐẠI HỌC CỬU LONG');

  useEffect(() => {
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

    if (systemConfig.googleClientId) {
      setGoogleClientIdInput(systemConfig.googleClientId);
    }

    if (systemConfig.defaultUniversity) {
      setUniversityInput(systemConfig.defaultUniversity);
    }
  }, [user, systemConfig]);

  if (!isOpen) return null;

  const detectedKeys = getAvailableKeys(apiKeyInput);

  const handleSave = () => {
    const trimmedModel = modelIdInput.trim() || DEFAULT_MODEL_ID;
    const trimmedKeys = apiKeyInput.trim();
    const trimmedGoogleClientId = googleClientIdInput.trim();

    saveUserApiKey(trimmedKeys);
    saveUserGeminiModel(trimmedModel);

    updateSystemConfig({
      ...(isSuperAdmin
        ? {
            defaultGeminiApiKey: trimmedKeys,
            defaultGeminiModel: trimmedModel,
            defaultUniversity: universityInput.trim(),
          }
        : {}),
      googleClientId: trimmedGoogleClientId,
    });

    toast.success(
      'Đã lưu cấu hình Gemini AI & Google OAuth!',
      `Model: ${trimmedModel} • ${detectedKeys.length} API Key hoạt động.`
    );
    confetti({ particleCount: 35, spread: 50 });
    onClose();
  };

  const handleTestConnection = async () => {
    if (detectedKeys.length === 0) {
      setTestingStatus('error');
      setTestMessage('Vui lòng nhập ít nhất 1 API key Gemini hợp lệ.');
      toast.warning('Chưa nhập API Key', 'Vui lòng dán ít nhất 1 Gemini API Key vào ô bên trên.');
      return;
    }

    setTestingStatus('testing');
    setTestMessage(`Đang kiểm tra kết nối với Model [${modelIdInput}]...`);

    try {
      const response = await callGeminiApi(
        'Xin chào, trả lời ngắn gọn "OK" để xác nhận kết nối thành công.',
        apiKeyInput,
        modelIdInput
      );
      setTestingStatus('success');
      setTestMessage(`Thành công! Hệ thống phản hồi: "${response.trim()}"`);
      toast.success('Kết nối Gemini thành công!', `Phản hồi: "${response.trim()}"`);
    } catch (err: any) {
      setTestingStatus('error');
      setTestMessage(`Thất bại: ${err.message}`);
      toast.error('Lỗi kết nối Gemini API', err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md modal-backdrop-enter">
      <div className="w-full max-w-lg canva-card rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 modal-card-enter border border-purple-100 dark:border-purple-900/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-[#7d2ae8] dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Cấu Hình Gemini Model &amp; API Key
              </h3>
              <p className="text-[11px] text-neutral-500">
                Tự do điền Model ID • Tự động chuyển đổi dự phòng khi quá tải (503/429)
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
          {/* 1. MODEL ID SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#7d2ae8]" />
                <span>Model ID Gemini (Tự Điền Hoặc Chọn Nhanh):</span>
              </label>
              <span className="text-[10px] font-mono text-neutral-400">
                Đang chọn: <strong className="text-[#7d2ae8] dark:text-purple-400">{modelIdInput}</strong>
              </span>
            </div>

            <input
              type="text"
              value={modelIdInput}
              onChange={e => {
                setModelIdInput(e.target.value);
                setTestingStatus('idle');
              }}
              placeholder="VD: gemini-2.0-flash, gemini-1.5-flash, gemini-2.5-flash..."
              className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs font-bold focus:ring-2 focus:ring-[#7d2ae8] outline-hidden shadow-xs transition"
            />

            {/* Quick-select chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {POPULAR_GEMINI_MODELS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setModelIdInput(m.id);
                    setTestingStatus('idle');
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition canva-tap border ${
                    modelIdInput === m.id
                      ? 'bg-[#7d2ae8] text-white border-transparent shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700 hover:bg-neutral-200/60'
                  }`}
                >
                  {m.id}
                </button>
              ))}
            </div>

            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-[11px] text-[#5c1fe6] dark:text-purple-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#7d2ae8] shrink-0" />
              <span>
                <strong>Chống lỗi 503 / 404 tự động:</strong> Nếu model bạn nhập đang quá tải (503) hoặc không tồn tại, hệ thống tự động chuyển sang <code>gemini-2.0-flash</code> và <code>gemini-1.5-flash</code> ngay lập tức.
              </span>
            </div>
          </div>

          {/* 2. API KEYS POOL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Google Gemini API Keys (Nhập 1 hoặc nhiều key cách nhau dấu phẩy):</span>
              </label>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {detectedKeys.length} key hợp lệ
              </span>
            </div>

            <textarea
              rows={3}
              value={apiKeyInput}
              onChange={e => {
                setApiKeyInput(e.target.value);
                setTestingStatus('idle');
              }}
              placeholder="AIzaSyA..., AIzaSyB..., AIzaSyC..."
              className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden shadow-xs transition"
            />

            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>Tự động xoay tua ngẫu nhiên khi 1 key hết hạn mức.</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-purple-600 dark:text-purple-400 hover:underline font-bold"
              >
                Lấy key miễn phí tại Google AI Studio →
              </a>
            </div>
          </div>

          {/* 3. GOOGLE OAUTH CLIENT ID */}
          <div className="space-y-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00c4cc]" />
                <span>Google OAuth Client ID (Đăng nhập Google thật):</span>
              </label>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#7d2ae8] dark:text-purple-400 hover:underline font-bold"
              >
                Google Cloud Console →
              </a>
            </div>
            <input
              type="text"
              value={googleClientIdInput}
              onChange={e => setGoogleClientIdInput(e.target.value)}
              placeholder="VD: 1234567890-abcdefg.apps.googleusercontent.com"
              className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-xs focus:ring-2 focus:ring-[#7d2ae8] outline-hidden shadow-xs transition"
            />
          </div>

          {/* Test Connection Button & Status */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingStatus === 'testing' || !apiKeyInput.trim()}
                className="canva-btn-secondary px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition canva-tap flex items-center gap-1.5 disabled:opacity-50"
              >
                {testingStatus === 'testing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#7d2ae8]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#7d2ae8]" />
                )}
                <span>Kiểm Tra Kết Nối Ngay</span>
              </button>

              {testingStatus === 'success' && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Hoạt động hoàn hảo
                </span>
              )}
              {testingStatus === 'error' && (
                <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Lỗi kết nối
                </span>
              )}
            </div>

            {testMessage && (
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 font-mono break-all leading-relaxed">
                {testMessage}
              </p>
            )}
          </div>
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
            <span>Lưu Cấu Hình</span>
          </button>
        </div>
      </div>
    </div>
  );
}
