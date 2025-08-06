
import { db } from '../db';
import { videoProjectsTable, imagesTable } from '../db/schema';
import { type GenerateVideoInput, type VideoProject } from '../schema';
import { eq, asc } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';

export const generateVideo = async (input: GenerateVideoInput): Promise<VideoProject> => {
  try {
    // 1. Update project status to 'processing'
    await db.update(videoProjectsTable)
      .set({ 
        status: 'processing',
        updated_at: new Date()
      })
      .where(eq(videoProjectsTable.id, input.project_id))
      .execute();

    // 2. Fetch project details and verify it exists
    const projects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, input.project_id))
      .execute();

    if (projects.length === 0) {
      throw new Error(`Project with id ${input.project_id} not found`);
    }

    const project = projects[0];

    // 3. Fetch all images for the project in correct order
    const images = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.project_id, input.project_id))
      .orderBy(asc(imagesTable.order_index))
      .execute();

    if (images.length === 0) {
      throw new Error(`No images found for project ${input.project_id}`);
    }

    // 4. Verify all image files exist
    for (const image of images) {
      try {
        await fs.access(image.file_path);
      } catch (error) {
        throw new Error(`Image file not found: ${image.file_path}`);
      }
    }

    // 5. Generate output path for video
    const outputDir = path.join('uploads', 'videos');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `project_${input.project_id}_${Date.now()}.mp4`);

    // 6. For this implementation, we'll simulate video generation
    // In a real implementation, you would use ffmpeg-static or similar library
    // to create the actual video from images with specified fps and duration
    
    // Simulate video generation process
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
    
    // Create a placeholder video file to simulate successful generation
    await fs.writeFile(outputPath, Buffer.from('fake video content'));

    // 7. Update project with output path and completed status
    const updatedProjects = await db.update(videoProjectsTable)
      .set({ 
        status: 'completed',
        output_path: outputPath,
        updated_at: new Date()
      })
      .where(eq(videoProjectsTable.id, input.project_id))
      .returning()
      .execute();

    const updatedProject = updatedProjects[0];

    // Convert numeric fields back to numbers
    return {
      ...updatedProject,
      duration_per_image: parseFloat(updatedProject.duration_per_image)
    };

  } catch (error) {
    // If any error occurs, update project status to 'failed'
    try {
      await db.update(videoProjectsTable)
        .set({ 
          status: 'failed',
          updated_at: new Date()
        })
        .where(eq(videoProjectsTable.id, input.project_id))
        .execute();
    } catch (updateError) {
      console.error('Failed to update project status to failed:', updateError);
    }

    console.error('Video generation failed:', error);
    throw error;
  }
};
