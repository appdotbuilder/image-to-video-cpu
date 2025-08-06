
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videoProjectsTable, imagesTable } from '../db/schema';
import { type UploadImageInput, type CreateVideoProjectInput } from '../schema';
import { uploadImage } from '../handlers/upload_image';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// Base64 encoded 1x1 pixel red PNG image
const testImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAOH0dpgAAAABJRU5ErkJggg==';

// Create test project helper
const createTestProject = async (): Promise<number> => {
  const result = await db.insert(videoProjectsTable)
    .values({
      name: 'Test Project',
      duration_per_image: '2.00',
      fps: 30
    })
    .returning()
    .execute();
  
  return result[0].id;
};

// Clean up uploads directory
const cleanupUploads = () => {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
  if (fs.existsSync(uploadsDir)) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
};

describe('uploadImage', () => {
  beforeEach(async () => {
    await createDB();
    cleanupUploads();
  });
  
  afterEach(async () => {
    await resetDB();
    cleanupUploads();
  });

  it('should upload an image successfully', async () => {
    const projectId = await createTestProject();
    
    const testInput: UploadImageInput = {
      project_id: projectId,
      filename: 'test-image.png',
      file_data: testImageData,
      mime_type: 'image/png',
      order_index: 0
    };

    const result = await uploadImage(testInput);

    // Verify returned image object
    expect(result.id).toBeDefined();
    expect(result.project_id).toEqual(projectId);
    expect(result.filename).toEqual('test-image.png');
    expect(result.file_size).toEqual(Buffer.from(testImageData, 'base64').length);
    expect(result.mime_type).toEqual('image/png');
    expect(result.order_index).toEqual(0);
    expect(result.uploaded_at).toBeInstanceOf(Date);
    expect(result.file_path).toContain('uploads/images/test-image.png');
  });

  it('should save image record to database', async () => {
    const projectId = await createTestProject();
    
    const testInput: UploadImageInput = {
      project_id: projectId,
      filename: 'test-db-image.png',
      file_data: testImageData,
      mime_type: 'image/png',
      order_index: 1
    };

    const result = await uploadImage(testInput);

    // Query database to verify record was saved
    const images = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.id, result.id))
      .execute();

    expect(images).toHaveLength(1);
    expect(images[0].filename).toEqual('test-db-image.png');
    expect(images[0].project_id).toEqual(projectId);
    expect(images[0].file_size).toEqual(Buffer.from(testImageData, 'base64').length);
    expect(images[0].order_index).toEqual(1);
  });

  it('should save image file to disk', async () => {
    const projectId = await createTestProject();
    
    const testInput: UploadImageInput = {
      project_id: projectId,
      filename: 'test-file.png',
      file_data: testImageData,
      mime_type: 'image/png',
      order_index: 0
    };

    const result = await uploadImage(testInput);

    // Check if file exists on disk
    expect(fs.existsSync(result.file_path)).toBe(true);
    
    // Verify file content matches
    const savedData = fs.readFileSync(result.file_path);
    const originalData = Buffer.from(testImageData, 'base64');
    expect(savedData.equals(originalData)).toBe(true);
  });

  it('should create uploads directory if it does not exist', async () => {
    const projectId = await createTestProject();
    
    // Ensure directory doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
    expect(fs.existsSync(uploadsDir)).toBe(false);
    
    const testInput: UploadImageInput = {
      project_id: projectId,
      filename: 'create-dir-test.png',
      file_data: testImageData,
      mime_type: 'image/png',
      order_index: 0
    };

    await uploadImage(testInput);

    // Verify directory was created
    expect(fs.existsSync(uploadsDir)).toBe(true);
  });

  it('should throw error for non-existent project', async () => {
    const testInput: UploadImageInput = {
      project_id: 99999, // Non-existent project ID
      filename: 'fail-test.png',
      file_data: testImageData,
      mime_type: 'image/png',
      order_index: 0
    };

    expect(uploadImage(testInput)).rejects.toThrow(/project.*not found/i);
  });

  it('should handle multiple images for same project', async () => {
    const projectId = await createTestProject();
    
    const input1: UploadImageInput = {
      project_id: projectId,
      filename: 'image1.png',
      file_data: testImageData,
      mime_type: 'image/png',
      order_index: 0
    };
    
    const input2: UploadImageInput = {
      project_id: projectId,
      filename: 'image2.png',
      file_data: testImageData,
      mime_type: 'image/png',
      order_index: 1
    };

    const result1 = await uploadImage(input1);
    const result2 = await uploadImage(input2);

    // Verify both images were created with correct order
    expect(result1.order_index).toEqual(0);
    expect(result2.order_index).toEqual(1);
    expect(result1.project_id).toEqual(projectId);
    expect(result2.project_id).toEqual(projectId);
    
    // Verify both files exist
    expect(fs.existsSync(result1.file_path)).toBe(true);
    expect(fs.existsSync(result2.file_path)).toBe(true);
  });
});
