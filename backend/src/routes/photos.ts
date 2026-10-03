import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { Router } from 'express';
import { config } from '../config';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/error';
import { getOwnedTree } from '../repo';
import { analyzePhotoBuffer } from '../services/imageAnalysis';
import { photoDirections } from '../validation';
import { z } from 'zod';
import { photoUrl } from './trees';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoBytes, files: 1 },
});

function isJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}
function isPng(buf: Buffer): boolean {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

const photoMetaSchema = z.object({
  direction: z.enum(photoDirections).default('OTHER'),
  headingDeg: z.coerce.number().min(0).max(360).optional(),
  capturedAt: z.string().datetime().optional(),
  clientPhotoId: z.string().uuid().optional(),
});

export const photosRouter = Router();
photosRouter.use(requireAuth);

photosRouter.post(
  '/:treeId/photos',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'no_file', 'Attach a photo field (JPEG or PNG, max 12 MB)');
    const buffer = req.file.buffer;
    if (!isJpeg(buffer) && !isPng(buffer)) {
      throw new ApiError(415, 'unsupported_media', 'Only JPEG or PNG photos are accepted');
    }
    const meta = photoMetaSchema.parse(req.body ?? {});
    const { tree } = await getOwnedTree(req.params.treeId, req.user!.id);

    if (meta.clientPhotoId) {
      const dup = await query<{ id: string }>('SELECT id FROM tree_photos WHERE client_photo_id = $1', [
        meta.clientPhotoId,
      ]);
      if (dup.length > 0) {
        res.status(200).json({ duplicated: true, photoId: dup[0].id });
        return;
      }
    }

    // Verify it is a real decodable image, then store.
    let width: number | undefined;
    let height: number | undefined;
    try {
      const metaImg = await sharp(buffer, { failOn: 'none' }).metadata();
      width = metaImg.width;
      height = metaImg.height;
    } catch {
      throw new ApiError(415, 'unsupported_media', 'The file is not a valid image');
    }

    const dir = path.join(config.photosDir, tree.id.slice(0, 2), tree.id);
    fs.mkdirSync(dir, { recursive: true });
    const name = `${crypto.randomUUID()}.jpg`;
    const filePath = path.join(dir, name);
    const thumbPath = path.join(dir, `${name.slice(0, -4)}-t.jpg`);

    const jpeg = await sharp(buffer, { failOn: 'none' }).rotate().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const thumb = await sharp(buffer, { failOn: 'none' }).rotate().resize({ width: 480, height: 480, fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
    fs.writeFileSync(filePath, jpeg);
    fs.writeFileSync(thumbPath, thumb);

    let analysis = null;
    try {
      analysis = await analyzePhotoBuffer(jpeg);
    } catch (err) {
      console.warn('[photos] analysis failed, storing without analysis:', (err as Error).message);
    }

    const rows = await query<{ id: string; uploaded_at: Date }>(
      `INSERT INTO tree_photos (tree_id, client_photo_id, direction, heading_deg, file_path, thumb_path,
                                width, height, captured_at, analysis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, uploaded_at`,
      [
        tree.id, meta.clientPhotoId ?? null, meta.direction, meta.headingDeg ?? null,
        filePath, thumbPath, width ?? null, height ?? null, meta.capturedAt ?? null, analysis,
      ],
    );

    await query('UPDATE trees SET last_assessed_at = now() WHERE id = $1', [tree.id]);

    res.status(201).json({
      photoId: rows[0].id,
      duplicated: false,
      url: photoUrl(filePath),
      thumbUrl: photoUrl(thumbPath),
      width,
      height,
      analysis,
    });
  }),
);

photosRouter.get(
  '/:treeId/photos',
  asyncHandler(async (req, res) => {
    await getOwnedTree(req.params.treeId, req.user!.id);
    const rows = await query<{
      id: string; direction: string; file_path: string; thumb_path: string | null;
      width: number | null; height: number | null; captured_at: Date | null; uploaded_at: Date;
      analysis: unknown;
    }>(
      `SELECT id, direction, file_path, thumb_path, width, height, captured_at, uploaded_at, analysis
       FROM tree_photos WHERE tree_id = $1 ORDER BY uploaded_at DESC`,
      [req.params.treeId],
    );
    res.json({
      photos: rows.map((p) => ({
        id: p.id,
        direction: p.direction,
        url: photoUrl(p.file_path),
        thumbUrl: photoUrl(p.thumb_path),
        width: p.width,
        height: p.height,
        capturedAt: p.captured_at,
        uploadedAt: p.uploaded_at,
        analysis: p.analysis,
      })),
    });
  }),
);

photosRouter.delete(
  '/:photoId',
  asyncHandler(async (req, res) => {
    const rows = await query<{ file_path: string; thumb_path: string | null; owner: string }>(
      `SELECT p.file_path, p.thumb_path, o.owner_id AS owner
       FROM tree_photos p JOIN trees t ON t.id = p.tree_id JOIN orchards o ON o.id = t.orchard_id
       WHERE p.id = $1`,
      [req.params.photoId],
    );
    if (rows.length === 0 || rows[0].owner !== req.user!.id) {
      throw new ApiError(404, 'photo_not_found', 'Photo not found');
    }
    await query('DELETE FROM tree_photos WHERE id = $1', [req.params.photoId]);
    const fsp = fs.promises;
    await fsp.rm(rows[0].file_path, { force: true }).catch(() => undefined);
    if (rows[0].thumb_path) await fsp.rm(rows[0].thumb_path, { force: true }).catch(() => undefined);
    res.json({ ok: true });
  }),
);
