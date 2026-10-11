import React, { useState } from 'react';
import { Bell, Check, Mail, MessageSquare, Smartphone, ShieldCheck, X } from 'lucide-react';
import { NotificationItem, NotificationPreferences } from '../server/types';
import { fetchGraphQL } from '../lib/api';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  preferences: NotificationPreferences;
  onRefresh: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  preferences,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'settings'>('feed');
  const [emailPref, setEmailPref] = useState(preferences.emailEnabled);
  const [pushPref, setPushPref] = useState(preferences.pushEnabled);
  const [whatsappPref, setWhatsappPref] = useState(preferences.whatsappEnabled);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    try {
      await fetchGraphQL(`mutation { markAllNotificationsRead }`);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePreferences = async () => {
    try {
      await fetchGraphQL(`
        mutation UpdatePrefs($email: Boolean, $push: Boolean, $wa: Boolean) {
          updateNotificationPreferences(emailEnabled: $email, pushEnabled: $push, whatsappEnabled: $wa) {
            emailEnabled
            pushEnabled
            whatsappEnabled
          }
        }
      `, { email: emailPref, push: pushPref, wa: whatsappPref });
      onRefresh();
      alert('Notification preferences updated successfully.');
    } catch (err: any) {
      alert(`Failed to save preferences: ${err.message}`);
    }
  };

  const triggerTestNotification = async (channel: 'in_app' | 'push' | 'email' | 'whatsapp') => {
    setTestStatus(`Dispatching ${channel} verification event...`);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus(`Test event dispatched to ${channel} adapter successfully!`);
        onRefresh();
      }
    } catch (err: any) {
      setTestStatus(`Failed: ${err.message}`);
    }
    setTimeout(() => setTestStatus(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0f1722] border border-[#232f42] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232f42]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Notification Center</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#1a2533]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-6 py-2 bg-[#0a0f16] border-b border-[#232f42] text-xs">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Activity Feed ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Channels &amp; Rules
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeTab === 'feed' ? (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-[#1d2737] text-xs text-slate-400">
                <span>Recent System &amp; Co-Work Events</span>
                <button
                  onClick={handleMarkAllRead}
                  className="text-emerald-400 hover:underline"
                >
                  Mark all read
                </button>
              </div>

              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg border text-xs ${
                    n.read
                      ? 'bg-[#111822] border-[#222e3f] text-slate-400'
                      : 'bg-[#13201a] border-emerald-500/40 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">{n.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="leading-relaxed">{n.message}</p>
                </div>
              ))}

              {notifications.length === 0 && (
                <div className="py-16 text-center text-xs text-slate-500">
                  No notifications recorded yet.
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-semibold text-white mb-2">Delivery Channels</h4>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-lg bg-[#111822] border border-[#232f42]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-medium text-white">Email (Nodemailer / SMTP)</div>
                        <div className="text-[11px] text-slate-500">Critical alerts and task completions</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailPref}
                      onChange={(e) => setEmailPref(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg bg-[#111822] border border-[#232f42]">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-medium text-white">Web &amp; Android Push (FCM)</div>
                        <div className="text-[11px] text-slate-500">Real-time task and stream notifications</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={pushPref}
                      onChange={(e) => setPushPref(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg bg-[#111822] border border-[#232f42]">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-medium text-white">WhatsApp (Official Cloud API)</div>
                        <div className="text-[11px] text-slate-500">Optional opt-in messaging</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={whatsappPref}
                      onChange={(e) => setWhatsappPref(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </label>
                </div>
              </div>

              {/* Channel Probing & Verification */}
              <div className="pt-2 border-t border-[#1d2737]">
                <h4 className="font-semibold text-white mb-2">Test Channel Handlers</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => triggerTestNotification('in_app')}
                    className="p-2 text-slate-300 bg-[#16212e] hover:bg-[#1e2f42] border border-[#27374d] rounded text-left transition-colors cursor-pointer"
                  >
                    Test In-App Feed
                  </button>
                  <button
                    onClick={() => triggerTestNotification('email')}
                    className="p-2 text-slate-300 bg-[#16212e] hover:bg-[#1e2f42] border border-[#27374d] rounded text-left transition-colors cursor-pointer"
                  >
                    Test SMTP Adapter
                  </button>
                  <button
                    onClick={() => triggerTestNotification('push')}
                    className="p-2 text-slate-300 bg-[#16212e] hover:bg-[#1e2f42] border border-[#27374d] rounded text-left transition-colors cursor-pointer"
                  >
                    Test Push / FCM
                  </button>
                  <button
                    onClick={() => triggerTestNotification('whatsapp')}
                    className="p-2 text-slate-300 bg-[#16212e] hover:bg-[#1e2f42] border border-[#27374d] rounded text-left transition-colors cursor-pointer"
                  >
                    Test WhatsApp Adapter
                  </button>
                </div>

                {testStatus && (
                  <div className="mt-2 p-2 bg-[#102219] border border-emerald-500/40 rounded text-[11px] text-emerald-400">
                    {testStatus}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-1.5 font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors cursor-pointer"
                >
                  Save Channel Rules
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
