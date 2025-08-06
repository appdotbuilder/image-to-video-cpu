
import { db } from '../db';
import { videoProjectsTable } from '../db/schema';
import { type UpdateProjectStatusInput, type VideoProject } from '../schema';
import { eq } from 'drizzle-orm';

export const updateProjectStatus = async (input: UpdateProjectStatusInput): Promise<VideoProject> => {
  try {
    // Build update values
    const updateValues: any = {
      status: input.status,
      updated_at: new Date()
    };

    // Only update output_path if provided
    if (input.output_path !== undefined) {
      updateValues.output_path = input.output_path;
    }

    // Update the project
    const result = await db.update(videoProjectsTable)
      .set(updateValues)
      .where(eq(videoProjectsTable.id, input.project_id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Project with id ${input.project_id} not found`);
    }

    // Convert numeric fields back to numbers before returning
    const project = result[0];
    return {
      ...project,
      duration_per_image: parseFloat(project.duration_per_image)
    };
  } catch (error) {
    console.error('Project status update failed:', error);
    throw error;
  }
};
