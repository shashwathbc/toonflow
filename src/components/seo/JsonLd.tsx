// Emits a schema.org JSON-LD block for rich search results (audit L4).
// Rendered inside the (client) detail pages once their data loads; Googlebot
// executes client JS, so the structured data is picked up. Moving the detail
// pages to a server component with generateMetadata would make this SSR-strong,
// but this is a safe, self-contained first step.
//
// The `<` → `<` escape prevents a `</script>` in any field (title,
// synopsis) from breaking out of the script tag.
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
