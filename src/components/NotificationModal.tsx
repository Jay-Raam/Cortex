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
      await fetchGraphQL(
        `
        mutation UpdatePrefs($email: Boolean, $push: Boolean, $wa: Boolean) {
          updateNotificationPreferences(emailEnabled: $email, pushEnabled: $push, whatsappEnabled: $wa) {
            emailEnabled
            pushEnabled
            whatsappEnabled
          }
        }
      `,
        { email: emailPref, push: pushPref, wa: whatsappPref }
      );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Notification Center</h2>
              <p className="text-[11px] text-slate-500">Live alerts and delivery channel preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-6 py-2 bg-slate-50 border-b border-slate-100 text-xs">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-white text-[#FF6B00] shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activity Feed ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-[#FF6B00] shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Channels &amp; Rules
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
          {activeTab === 'feed' ? (
            <>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-500">
                <span>Recent System &amp; Co-Work Events</span>
                <button
                  onClick={handleMarkAllRead}
                  className="text-[#FF6B00] hover:text-[#E86000] font-medium hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              </div>

              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border text-xs transition-colors ${
                    n.read
                      ? 'bg-white border-slate-200 text-slate-500'
                      : 'bg-[#FFFBF7] border-orange-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900">{n.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="leading-relaxed">{n.message}</p>
                </div>
              ))}

              {notifications.length === 0 && (
                <div className="py-16 text-center text-xs text-slate-400">
                  No notifications recorded yet.
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Delivery Channels</h4>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-slate-600" />
                      <div>
                        <div className="font-semibold text-slate-900">Email (Nodemailer / SMTP)</div>
                        <div className="text-[11px] text-slate-500">Critical alerts and task completions</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailPref}
                      onChange={(e) => setEmailPref(e.target.checked)}
                      className="accent-[#FF6B00] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-slate-600" />
                      <div>
                        <div className="font-semibold text-slate-900">Web &amp; Android Push (FCM)</div>
                        <div className="text-[11px] text-slate-500">Real-time task and stream notifications</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={pushPref}
                      onChange={(e) => setPushPref(e.target.checked)}
                      className="accent-[#FF6B00] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-slate-600" />
                      <div>
                        <div className="font-semibold text-slate-900">WhatsApp (Official Cloud API)</div>
                        <div className="text-[11px] text-slate-500">Optional opt-in messaging</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={whatsappPref}
                      onChange={(e) => setWhatsappPref(e.target.checked)}
                      className="accent-[#FF6B00] w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Channel Probing & Verification */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-2">Test Channel Handlers</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => triggerTestNotification('in_app')}
                    className="p-2.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors cursor-pointer font-medium"
                  >
                    Test In-App Feed
                  </button>
                  <button
                    onClick={() => triggerTestNotification('email')}
                    className="p-2.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors cursor-pointer font-medium"
                  >
                    Test SMTP Adapter
                  </button>
                  <button
                    onClick={() => triggerTestNotification('push')}
                    className="p-2.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors cursor-pointer font-medium"
                  >
                    Test Push / FCM
                  </button>
                  <button
                    onClick={() => triggerTestNotification('whatsapp')}
                    className="p-2.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors cursor-pointer font-medium"
                  >
                    Test WhatsApp Adapter
                  </button>
                </div>

                {testStatus && (
                  <div className="mt-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg text-[11px] text-[#FF6B00] font-medium">
                    {testStatus}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 font-semibold text-white bg-[#FF6B00] hover:bg-[#E86000] active:scale-95 rounded-xl transition-all cursor-pointer shadow-2xs"
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
