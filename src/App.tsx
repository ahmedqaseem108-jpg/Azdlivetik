import {
  FlaskConical,
  Globe,
  Menu,
  MessageSquare,
  MonitorPlay,
  Radio,
  Sliders,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ObsOverlayView } from './components/ObsOverlayView';
import { AlertsCommentsPanel } from './components/panels/AlertsCommentsPanel';
import { AudioApiPanel } from './components/panels/AudioApiPanel';
import { EffectsEditorPanel } from './components/panels/EffectsEditorPanel';
import { LiveControlPanel } from './components/panels/LiveControlPanel';
import { ObsStudioPanel } from './components/panels/ObsStudioPanel';
import { SupportersPanel } from './components/panels/SupportersPanel';
import { TestingLabPanel } from './components/panels/TestingLabPanel';
import { getT } from './shared/i18n';
import { type ActiveSection, useLiveStore } from './store/useLiveStore';

function extractOverlayIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/overlay\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const overlayRouteId = extractOverlayIdFromPath();

  // Standalone OBS Browser Source route (/overlay/:unique_id)
  if (overlayRouteId) {
    return <ObsOverlayView overlayId={overlayRouteId} />;
  }

  return <StudioWorkspace />;
}

function StudioWorkspace() {
  const language = useLiveStore((s) => s.language);
  const setLanguage = useLiveStore((s) => s.setLanguage);
  const activeSection = useLiveStore((s) => s.activeSection);
  const setActiveSection = useLiveStore((s) => s.setActiveSection);
  const overlayId = useLiveStore((s) => s.overlayId);
  const initRoomSocket = useLiveStore((s) => s.initRoomSocket);
  const wsConnected = useLiveStore((s) => s.wsConnected);
  const connection = useLiveStore((s) => s.connection);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = getT(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    const cleanup = initRoomSocket(overlayId, 'control');
    return cleanup;
  }, [overlayId, initRoomSocket]);

  const navItems: Array<{
    id: ActiveSection;
    label: string;
    icon: typeof Radio;
  }> = [
    { id: 'control', label: t.nav.control, icon: Radio },
    { id: 'testing', label: t.nav.testing, icon: FlaskConical },
    { id: 'editor', label: t.nav.editor, icon: Sliders },
    { id: 'supporters', label: t.nav.supporters, icon: Trophy },
    { id: 'alerts', label: t.nav.alerts, icon: MessageSquare },
    { id: 'obs', label: t.nav.obs, icon: MonitorPlay },
    { id: 'audioApi', label: t.nav.audioApi, icon: Volume2 },
  ];

  const activeNav = navItems.find((n) => n.id === activeSection) || navItems[0];

  const renderPanel = () => {
    switch (activeSection) {
      case 'testing':
        return <TestingLabPanel />;
      case 'editor':
        return <EffectsEditorPanel />;
      case 'supporters':
        return <SupportersPanel />;
      case 'alerts':
        return <AlertsCommentsPanel />;
      case 'obs':
        return <ObsStudioPanel />;
      case 'audioApi':
        return <AudioApiPanel />;
      case 'control':
      default:
        return <LiveControlPanel />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#09090F] text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[252px] shrink-0 flex-col border-e border-white/8 bg-[#0C0C15] lg:flex">
        <div className="flex h-16 items-center px-5 border-b border-white/8">
          <span className="font-display text-base font-extrabold tracking-tight text-white whitespace-nowrap">
            LIVE EFFECTS <span className="text-[#7C3AED]">PRO</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                  active
                    ? 'bg-[#7C3AED] text-white shadow-md shadow-[#7C3AED]/20'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/8 p-4 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>{language === 'ar' ? 'خادم المزامنة' : 'Sync Socket'}</span>
            <span className={wsConnected ? 'font-semibold text-emerald-400' : 'text-amber-400'}>
              {wsConnected
                ? language === 'ar'
                  ? 'متصل'
                  : 'Online'
                : language === 'ar'
                  ? 'جاري الاتصال'
                  : 'Reconnecting'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span>{language === 'ar' ? 'معرّف OBS' : 'Overlay ID'}</span>
            <span className="font-mono-num text-[11px] text-[#00D4FF]">{overlayId}</span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-[#0C0C15] border-e border-white/10">
            <div className="flex h-16 items-center justify-between border-b border-white/8 px-4">
              <span className="font-display text-sm font-extrabold text-white">
                LIVE EFFECTS <span className="text-[#7C3AED]">PRO</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold ${
                      active ? 'bg-[#7C3AED] text-white' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Contextual Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/8 bg-[#09090F]/92 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-display font-bold text-slate-400 lg:hidden whitespace-nowrap">
                LIVE EFFECTS PRO
              </span>
              <span className="hidden text-slate-500 lg:inline">Studio</span>
              <span aria-hidden="true" className="text-slate-600">/</span>
              <span className="truncate font-bold text-white">{activeNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden text-xs text-slate-400 sm:inline whitespace-nowrap">
              {connection.status === 'connected' && connection.username
                ? `@${connection.username} · ${t.status.connected}`
                : t.status[connection.status]}
            </span>

            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#141422] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#7C3AED] hover:text-white"
            >
              <Globe className="h-3.5 w-3.5 text-[#00D4FF]" />
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}
