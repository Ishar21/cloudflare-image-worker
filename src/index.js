export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // List images stored in R2
    if (path === "/list-images") {
      const objects = await env.R2.list()
      return jsonResponse(objects)
    }

    // Show metadata stored in D1
    if (path === "/audit") {
      const result = await env.DB.prepare(
        "SELECT filename, alt_text, processed_at FROM images ORDER BY processed_at DESC"
      ).all()

      return jsonResponse(result.results)
    }

    // Ingest a new image from an external URL
    if (path === "/ingest" && request.method === "POST") {

      const authHeader = request.headers.get("x-ingest-token")

      if (env.INGEST_TOKEN && authHeader !== env.INGEST_TOKEN) {
        return new Response("Unauthorized", { status: 401 })
      }

      let body

      try {
        body = await request.json()
      } catch {
        return new Response("Invalid JSON body", { status: 400 })
      }

      const imageUrl = body?.imageUrl

      if (!imageUrl) {
        return new Response("Missing imageUrl", { status: 400 })
      }

      const upstream = await fetch(imageUrl)

      if (!upstream.ok) {
        return new Response(`Upstream returned ${upstream.status}`, { status: 400 })
      }

      const contentType =
        upstream.headers.get("content-type") || "application/octet-stream"

      if (!contentType.startsWith("image/")) {
        return new Response("URL did not return an image", { status: 400 })
      }

      const imageBytes = await upstream.arrayBuffer()

      const filenameFromUrl =
        new URL(imageUrl).pathname.split("/").pop() || "ingested-image"

      const safeFilename = filenameFromUrl.includes(".")
        ? filenameFromUrl
        : `${filenameFromUrl}.jpg`

      await env.R2.put(safeFilename, imageBytes, {
        httpMetadata: { contentType }
      })

      // Run AI generation in background
      ctx.waitUntil(generateAndStoreAltText(env, safeFilename))

      return jsonResponse({
        success: true,
        filename: safeFilename,
        sourceUrl: imageUrl,
        contentType
      })
    }

    // Serve images
    const key = path.slice(1)

    if (!key) {
      return new Response("No image specified", { status: 400 })
    }

    const useCache = request.method === "GET"
    const cache = caches.default
    const cacheKey = new Request(url.toString(), { method: "GET" })

    if (useCache) {
      const cached = await cache.match(cacheKey)
      if (cached) {
        return cached
      }
    }

    const object = await env.R2.get(key)

    if (!object) {
      return new Response("Image not found", { status: 404 })
    }

    let altText = "Description unavailable"

    const existing = await env.DB.prepare(
      "SELECT alt_text FROM images WHERE filename = ?"
    ).bind(key).first()

    if (existing?.alt_text && existing.alt_text !== "Pending AI description") {
      altText = existing.alt_text
    }
    else if (request.method === "GET") {
      altText = await generateAndStoreAltText(env, key)
    }
    else {
      altText = "Pending AI description"
    }

    const headers = new Headers()

    headers.set(
      "Content-Type",
      object.httpMetadata?.contentType || "application/octet-stream"
    )

    headers.set("Cache-Control", "public, max-age=3600")

    headers.set("X-Alt-Text", altText)

    const response =
      request.method === "HEAD"
        ? new Response(null, { headers })
        : new Response(object.body, { headers })

    if (useCache) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()))
    }

    return response
  }
}


async function generateAndStoreAltText(env, key) {

  const fallbackText = "Image description unavailable - manual review required"

  try {

    const existing = await env.DB.prepare(
      "SELECT alt_text FROM images WHERE filename = ?"
    ).bind(key).first()

    if (existing?.alt_text && existing.alt_text !== "Pending AI description") {
      return existing.alt_text
    }

    await env.DB.prepare(
      "INSERT OR REPLACE INTO images (filename, alt_text) VALUES (?, ?)"
    ).bind(key, "Pending AI description").run()

    const object = await env.R2.get(key)

    if (!object) {
      return fallbackText
    }

    const imageBytes = await object.arrayBuffer()

    const imageArray = Array.from(new Uint8Array(imageBytes))

    let altText = fallbackText

    try {

      const result = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
        prompt: "Write concise accessibility alt text for this image in one sentence.",
        image: imageArray,
        max_tokens: 128
      })

      altText =
        result?.description ||
        result?.result ||
        result?.response ||
        fallbackText

    } catch (aiError) {

      altText = fallbackText

    }

    await env.DB.prepare(
      "INSERT OR REPLACE INTO images (filename, alt_text) VALUES (?, ?)"
    ).bind(key, altText).run()

    return altText

  } catch (err) {

    return fallbackText

  }

}

function jsonResponse(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json" }
  })
}