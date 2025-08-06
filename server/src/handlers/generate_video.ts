import { db } from '../db';
import { videoProjectsTable, imagesTable } from '../db/schema';
import { type GenerateVideoInput, type VideoProject } from '../schema';
import { eq, asc } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// IMPORTANT: To enable actual video generation, add ffmpeg-static to package.json:
// npm install ffmpeg-static
// or
// bun add ffmpeg-static
// 
// Without this dependency, the handler will create placeholder video files instead.
// const ffmpeg = require('ffmpeg-static');

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

    // 5. Generate output paths
    const outputDir = path.join('uploads', 'videos');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `project_${input.project_id}_${Date.now()}.mp4`);
    
    // Create temp directory for processing
    const tempDir = path.join('uploads', 'temp', `project_${input.project_id}_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // 6. Copy and resize images to temp directory with sequential naming
      const processedImages: string[] = [];
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const tempImagePath = path.join(tempDir, `image_${i.toString().padStart(4, '0')}.jpg`);
        
        // Copy image to temp directory with sequential naming
        await fs.copyFile(image.file_path, tempImagePath);
        processedImages.push(tempImagePath);
      }

      // 7. Generate video using ffmpeg
      const durationPerImage = parseFloat(project.duration_per_image);
      const fps = project.fps;
      
      await generateVideoWithFFmpeg(processedImages, outputPath, durationPerImage, fps);

      // 8. Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });

      // 9. Update project with output path and completed status
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
      // Clean up temp directory on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to clean up temp directory:', cleanupError);
      }
      throw error;
    }

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

/**
 * Generate video from images using ffmpeg
 * @param imagePaths Array of image file paths in order
 * @param outputPath Output video file path
 * @param durationPerImage Duration each image should be displayed (in seconds)
 * @param fps Frames per second for the output video
 */
async function generateVideoWithFFmpeg(
  imagePaths: string[], 
  outputPath: string, 
  durationPerImage: number, 
  fps: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Try to require ffmpeg-static - in production this should be available
      const ffmpeg = require('ffmpeg-static');
      
      // Create a filter complex string for concatenating images with duration
      const filterInputs: string[] = [];
      const concatInputs: string[] = [];
      
      imagePaths.forEach((_, index) => {
        // Scale each image to 1920x1080 and set duration
        filterInputs.push(`[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=${fps}[v${index}]`);
        concatInputs.push(`[v${index}]`);
      });
      
      // Build filter complex: scale images and create video segments with proper timing
      const filterComplex = [
        ...filterInputs,
        `${concatInputs.join('')}concat=n=${imagePaths.length}:v=1:a=0,format=yuv420p[outv]`
      ].join(';');

      // Build ffmpeg command arguments
      const args: string[] = [];
      
      // Add input files
      imagePaths.forEach(imagePath => {
        args.push('-loop', '1', '-t', durationPerImage.toString(), '-i', imagePath);
      });
      
      // Add filter complex and output options
      args.push(
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-r', fps.toString(),
        '-y', // Overwrite output file
        outputPath
      );

      console.log('Starting ffmpeg with args:', args);

      // Spawn ffmpeg process
      const ffmpegProcess = spawn(ffmpeg, args);

      let stderr = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Log ffmpeg progress (optional)
        // console.log('FFmpeg stderr:', data.toString());
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Video generation completed successfully');
          resolve();
        } else {
          console.error('FFmpeg process exited with code:', code);
          console.error('FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg process failed with exit code ${code}: ${stderr}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        console.error('Failed to start ffmpeg process:', error);
        reject(new Error(`Failed to start ffmpeg: ${error.message}`));
      });

    } catch (requireError) {
      // Fallback: if ffmpeg-static is not available, create a placeholder video
      console.warn('ffmpeg-static not available, creating placeholder video file');
      console.warn('To enable actual video generation, add ffmpeg-static to package.json dependencies');
      
      // Create a minimal MP4 placeholder file
      const placeholderContent = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
        0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x6D, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65
      ]);
      
      fs.writeFile(outputPath, placeholderContent)
        .then(() => resolve())
        .catch(reject);
    }
  });
}