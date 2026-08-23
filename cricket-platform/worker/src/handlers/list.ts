import type { Env } from '../types'
import { HttpError } from '../types'
import { isKnownFolderKey } from '../limits'

const MAX_PAGES = 10 // 1000 objects/page by default — 10k ceiling is far beyond any real gallery

/** Unauthenticated by design: listing a folder's contents isn't privileged — it's no
 *  different from reading each file's metadata individually, and every file here is
 *  already publicly readable via the R2 public bucket URL. Matches this app's existing
 *  "public read" posture for every piece of cricket/media data. */
export async function handleList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const folder = url.searchParams.get('folder')
  if (!folder) throw new HttpError(400, 'Missing "folder" query parameter.')
  if (!isKnownFolderKey(folder)) throw new HttpError(400, 'Unknown folder.')

  const prefix = folder.endsWith('/') ? folder : `${folder}/`
  const items: { path: string; url: string; size: number; createdAt: number }[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await env.MEDIA_BUCKET.list({ prefix, cursor, limit: 1000 })
    for (const obj of result.objects) {
      items.push({
        path: obj.key,
        url: `${env.R2_PUBLIC_BASE_URL}/${obj.key}`,
        size: obj.size,
        createdAt: obj.uploaded.getTime(),
      })
    }
    if (!result.truncated) break
    cursor = result.cursor
  }
  items.sort((a, b) => b.createdAt - a.createdAt)

  return Response.json({ items })
}
