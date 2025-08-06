
import { db } from '../db';
import { videoProjectsTable } from '../db/schema';
import { type VideoProject } from '../schema';

export const getVideoProjects = async (): Promise<VideoProject[]> => {
  try {
    const results = await db.select()
      .from(videoProjectsTable)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(project => ({
      ...project,
      duration_per_image: parseFloat(project.duration_per_image)
    }));
  } catch (error) {
    console.error('Failed to fetch video projects:', error);
    throw error;
  }
};
