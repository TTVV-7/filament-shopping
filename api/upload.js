// Issues short-lived client upload tokens for Vercel Blob.
//
// Files go from the browser straight to Blob storage, which sidesteps Vercel's
// 4.5 MB serverless request-body limit -- STLs are routinely larger than that.
import { handleUpload } from "@vercel/blob/client";

const MAX_BYTES = 25 * 1024 * 1024;

// Browsers report 3D model files inconsistently (often octet-stream or empty),
// so this list is deliberately broad. Extension checks happen client-side.
const ALLOWED_CONTENT_TYPES = [
  "application/octet-stream",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  "model/stl",
  "model/3mf",
  "model/obj",
  "model/step",
  "application/step",
  "application/zip",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "text/plain",
];

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("upload: BLOB_READ_WRITE_TOKEN is not set");
    return new Response(JSON.stringify({ error: "Uploads are not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log(`Blob upload completed: ${blob.pathname} -> ${blob.url}`);
      },
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("upload: token generation failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// These handlers use the Web fetch signature (Request in, Response out),
// which requires the edge runtime -- under the Node runtime the default
// export is called as (req, res) and a returned Response is ignored,
// leaving the request to hang until it times out.
export const config = { runtime: "edge" };
