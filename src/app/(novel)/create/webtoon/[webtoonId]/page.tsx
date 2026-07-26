'use client'

import { use } from 'react'
import { CanvasEditor } from '@/components/editor/CanvasEditor'

interface PageProps {
  params: Promise<{ webtoonId: string }>
}

export default function WebtoonEditorPage({ params }: PageProps) {
  const { webtoonId } = use(params)
  return <CanvasEditor webtoonId={webtoonId} />
}
