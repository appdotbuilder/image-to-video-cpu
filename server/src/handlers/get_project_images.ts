
import { db } from '../db';
import { imagesTable } from '../db/schema';
import { type Image } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getProjectImages = async (projectId: number): Promise<Image[]> => {
  try {
    // Query images for the project, ordered by order_index
    const results = await db.select()
      .from(imagesTable)
      .where(eq(imagesTable.project_id, projectId))
      .orderBy(asc(imagesTable.order_index))
      .execute();

    // Return results (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Failed to fetch project images:', error);
    throw error;
  }
};
