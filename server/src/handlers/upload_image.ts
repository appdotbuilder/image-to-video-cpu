
import { db } from '../db';
import { imagesTable, videoProjectsTable } from '../db/schema';
import { type UploadImageInput, type Image } from '../schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

export const uploadImage = async (input: UploadImageInput): Promise<Image> => {
  try {
    // First, verify the project exists
    const projects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, input.project_id))
      .execute();

    if (projects.length === 0) {
      throw new Error(`Project with id ${input.project_id} not found`);
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Decode base64 image data
    const imageBuffer = Buffer.from(input.file_data, 'base64');
    const filePath = path.join(uploadsDir, input.filename);

    // Save image file to disk
    fs.writeFileSync(filePath, imageBuffer);

    // Insert image record into database
    const result = await db.insert(imagesTable)
      .values({
        project_id: input.project_id,
        filename: input.filename,
        file_path: filePath,
        file_size: imageBuffer.length,
        mime_type: input.mime_type,
        order_index: input.order_index
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
};
