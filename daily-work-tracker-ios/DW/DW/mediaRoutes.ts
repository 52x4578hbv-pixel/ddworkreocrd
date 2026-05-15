import express from 'express'
import multer from 'multer'
import path from 'path'

import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } from '@azure/storage-blob'
import { authenticateRole } from './auth'

const router = express.Router()

type UploadResponse = {
  success: boolean
  url: string
  blobName: string
}

const memoryUpload = multer({ storage: multer.memoryStorage() })

function guessExtFromFilename(originalname: string): string {
  const ext = path.extname(originalname ?? '').toLowerCase()
  if (!ext) return '.jpg'
  if (ext === '.jpeg') return '.jpg'
  if (ext === '.png') return '.png'
  return ext
}

function makeTenantScopedBlobName(tenantId: string, photoId: string, originalname: string): string {
  const ext = guessExtFromFilename(originalname)
  return `tenants/${tenantId}/workday-photos/${photoId}${ext}`
}

function parseAccountNameAndKey(connectionString: string): { accountName: string; accountKey: string } {
  // Example:
  // DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
  const parts = connectionString.split(';').map((p) => p.trim())
  const map = new Map<string, string>()

  for (const part of parts) {
    const [k, ...rest] = part.split('=')
    if (!k || rest.length === 0) continue
    map.set(k, rest.join('='))
  }

  const accountName = map.get('AccountName')
  const accountKey = map.get('AccountKey')

  if (!accountName || !accountKey) {
    throw new Error('Could not parse AccountName/AccountKey from AZURE_STORAGE_CONNECTION_STRING.')
  }

  return { accountName, accountKey }
}

function buildBlobSasUrl(params: {
  connectionString: string
  containerName: string
  blobName: string
  sasTtlSeconds: number
}): string {
  const { connectionString, containerName, blobName, sasTtlSeconds } = params

  const { accountName, accountKey } = parseAccountNameAndKey(connectionString)
  const credential = new StorageSharedKeyCredential(accountName, accountKey)

  const now = new Date()
  const expiry = new Date(now.getTime() + sasTtlSeconds * 1000)

  // Read-only SAS
  const permissions = BlobSASPermissions.parse('r')

  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions,
      protocol: SASProtocol.Https,
      startsOn: now,
      expiresOn: expiry,
    },
    credential
  )

  const baseUrl = `https://${accountName}.blob.core.windows.net`
  return `${baseUrl}/${containerName}/${blobName}?${sas.toString()}`
}

router.post(
  '/upload',
  authenticateRole(['admin', 'manager', 'worker']),
  memoryUpload.single('photo'),
  async (req, res) => {
    const photoIdRaw = req.body?.photoId
    const photoId = typeof photoIdRaw === 'string' ? photoIdRaw.trim() : ''

    const tenantId = (req as any).authTenantId as string | null
    if (!tenantId) {
      return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' })
    }

    if (!photoId) {
      return res.status(400).json({ error: 'Missing photoId field.' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME

    if (!connectionString || !containerName) {
      return res.status(500).json({
        error: 'Azure Blob Storage not configured. Set AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER_NAME.',
      })
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
      const containerClient = blobServiceClient.getContainerClient(containerName)

      await containerClient.createIfNotExists()

      const blobName = makeTenantScopedBlobName(tenantId, photoId, req.file.originalname)

      const blockBlobClient = containerClient.getBlockBlobClient(blobName)
      const contentType = req.file.mimetype ?? 'application/octet-stream'

      await blockBlobClient.uploadData(req.file.buffer, {
        blobHTTPHeaders: { blobContentType: contentType },
      })

      const sasTtlSeconds = Number(process.env.AZURE_BLOB_SAS_TTL_SECONDS ?? '3600')

      const url = buildBlobSasUrl({
        connectionString,
        containerName,
        blobName,
        sasTtlSeconds,
      })

      const response: UploadResponse = {
        success: true,
        url,
        blobName,
      }

      return res.status(200).json(response)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Azure Blob upload failed:', e)
      return res.status(500).json({ error: 'Failed to upload media.' })
    }
  }
)

export default router
