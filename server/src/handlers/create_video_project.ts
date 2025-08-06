
import { db } from '../db';
import { videoProjectsTable } from '../db/schema';
import { type CreateVideoProjectInput, type VideoProject } from '../schema';

export const createVideoProject = async (input: CreateVideoProjectInput): Promise<VideoProject> => {
  try {
    // Insert video project record
    const result = await db.insert(videoProjectsTable)
      .values({
        name: input.name,
        duration_per_image: input.duration_per_image.toString(), // Convert number to string for numeric column
        fps: input.fps // Integer column - no conversion needed
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const project = result[0];
    return {
      ...project,
      duration_per_image: parseFloat(project.duration_per_image) // Convert string back to number
    };
  } catch (error) {
    console.error('Video project creation failed:', error);
    throw error;
  }
};
