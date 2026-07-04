import SuperAdminLayoutShell from '@/components/admin/SuperAdminLayoutShell'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminLayoutShell>{children}</SuperAdminLayoutShell>
}
