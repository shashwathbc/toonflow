'use client'

import { useEffect, useState } from 'react'
import { Settings, Loader2, Save, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import {
  getPlatformSettings, updatePlatformSettings, createAuditLog,
  type PlatformSettings,
} from '@/lib/firebase/admin'
import { cn } from '@/lib/utils/cn'

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-bg-border/50 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-5.5 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none flex-shrink-0',
          checked ? 'bg-accent' : 'bg-bg-elevated border border-bg-border'
        )}
        style={{ height: '22px', width: '40px' }}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        )} />
      </button>
    </div>
  )
}

export default function AdminSettingsPage() {
  const { firebaseUser } = useAuth()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getPlatformSettings()
      .then(setSettings)
      .catch((e: unknown) => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings || !firebaseUser) return
    setSaving(true)
    try {
      await updatePlatformSettings(settings)
      await createAuditLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email!,
        action: 'update_settings',
        resource: 'settings',
        resourceId: 'platform',
        details: 'Updated platform settings',
      })
      setSaved(true)
      toast.success('Settings saved')
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  if (loading || !settings) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Settings size={18} aria-hidden="true" /> Platform Settings
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">Global configuration for Toonflow Studio Paint</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50',
            saved ? 'bg-accent/10 text-accent' : 'btn-accent'
          )}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Access Control */}
      <section className="bg-bg-card border border-bg-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text mb-1">Access Control</h2>
        <p className="text-xs text-text-muted mb-4">Control who can access the platform</p>
        <ToggleRow
          label="Maintenance Mode"
          description="Take the entire platform offline. Visitors see a maintenance page."
          checked={settings.maintenanceMode}
          onChange={(v) => set('maintenanceMode', v)}
        />
        <ToggleRow
          label="Allow New Signups"
          description="Let new users create accounts. Disable to lock registration."
          checked={settings.allowNewSignups}
          onChange={(v) => set('allowNewSignups', v)}
        />
        <ToggleRow
          label="Allow Content Creation"
          description="Let creators publish novels and webtoons."
          checked={settings.allowContentCreation}
          onChange={(v) => set('allowContentCreation', v)}
        />

        {settings.maintenanceMode && (
          <div className="mt-4">
            <label htmlFor="maintenance-msg" className="block text-xs font-medium text-text-secondary mb-1.5">
              Maintenance Message
            </label>
            <input
              id="maintenance-msg"
              type="text"
              value={settings.maintenanceMessage}
              onChange={(e) => set('maintenanceMessage', e.target.value)}
              className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="We'll be back shortly."
            />
          </div>
        )}
      </section>

      {/* Announcement */}
      <section className="bg-bg-card border border-bg-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text mb-1">Announcement Banner</h2>
        <p className="text-xs text-text-muted mb-4">Show a sitewide banner to all visitors</p>
        <ToggleRow
          label="Show Announcement"
          description="Display the announcement banner on every public page."
          checked={settings.announcementVisible}
          onChange={(v) => set('announcementVisible', v)}
        />
        {settings.announcementVisible && (
          <div className="mt-4">
            <label htmlFor="announcement-text" className="block text-xs font-medium text-text-secondary mb-1.5">
              Announcement Text
            </label>
            <textarea
              id="announcement-text"
              value={settings.announcementBanner}
              onChange={(e) => set('announcementBanner', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              placeholder="New feature launched! Check it out…"
            />
          </div>
        )}
      </section>

      {/* Limits */}
      <section className="bg-bg-card border border-bg-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text mb-1">Limits</h2>
        <p className="text-xs text-text-muted mb-4">Resource and usage limits</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="upload-size" className="block text-xs font-medium text-text-secondary mb-1.5">
              Max Upload Size (MB)
            </label>
            <input
              id="upload-size"
              type="number"
              min={1}
              max={100}
              value={settings.maxUploadSizeMB}
              onChange={(e) => set('maxUploadSizeMB', Number(e.target.value))}
              className="w-32 px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="ai-limit" className="block text-xs font-medium text-text-secondary mb-1.5">
              AI Generations per User per Day
            </label>
            <input
              id="ai-limit"
              type="number"
              min={0}
              max={500}
              value={settings.aiGenerationsPerDay}
              onChange={(e) => set('aiGenerationsPerDay', Number(e.target.value))}
              className="w-32 px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="default-role" className="block text-xs font-medium text-text-secondary mb-1.5">
              Default Role for New Users
            </label>
            <select
              id="default-role"
              value={settings.defaultUserRole}
              onChange={(e) => set('defaultUserRole', e.target.value as PlatformSettings['defaultUserRole'])}
              className="px-3 py-2 bg-bg-elevated border border-bg-border rounded-xl text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="user">user</option>
              <option value="creator">creator</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  )
}
