// Issues short-lived client upload tokens for Vercel Blob.
//
// Files go from the browser straight to Blob storage, which sidesteps Vercel's
// 4.5 MB serverless request-body limit -- STLs are routinely larger than that.
//
// Runs on the Node runtime (no `config` export): @vercel/blob pulls in undici,
// which the edge runtime rejects as an unsupported module. The DB routes stay
// on edge; only this one needs Node.
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("upload: BLOB_READ_WRITE_TOKEN is not set");
    return res.status(500).json({ error: "Uploads are not configured" });
  }

  try {
    const result = await handleUpload({
      body: req.body,
      // handleUpload reads signature headers the Web way; Node gives a plain
      // object, so wrap it to expose .get().
      request: { headers: new Headers(req.headers) },
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log(`Blob upload completed: ${blob.pathname} -> ${blob.url}`);
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("upload: token generation failed", error);
    return res.status(400).json({ error: error.message });
  }
}
