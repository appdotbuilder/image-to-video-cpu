
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videoProjectsTable, imagesTable } from '../db/schema';
import { type CreateVideoProjectInput, type UploadImageInput } from '../schema';
import { getProjectImages } from '../handlers/get_project_images';

describe('getProjectImages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return images for a project ordered by order_index', async () => {
    // Create test project
    const projectResult = await db.insert(videoProjectsTable)
      .values({
        name: 'Test Project',
        duration_per_image: '2.00',
        fps: 30
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Create test images with different order indices
    const imageInputs = [
      {
        project_id: projectId,
        filename: 'image3.jpg',
        file_path: '/uploads/image3.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        order_index: 2
      },
      {
        project_id: projectId,
        filename: 'image1.jpg',
        file_path: '/uploads/image1.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        order_index: 0
      },
      {
        project_id: projectId,
        filename: 'image2.jpg',
        file_path: '/uploads/image2.jpg',
        file_size: 3072,
        mime_type: 'image/jpeg',
        order_index: 1
      }
    ];

    await db.insert(imagesTable).values(imageInputs).execute();

    // Fetch images
    const result = await getProjectImages(projectId);

    // Verify results are ordered correctly by order_index
    expect(result).toHaveLength(3);
    expect(result[0].filename).toEqual('image1.jpg');
    expect(result[0].order_index).toEqual(0);
    expect(result[1].filename).toEqual('image2.jpg');
    expect(result[1].order_index).toEqual(1);
    expect(result[2].filename).toEqual('image3.jpg');
    expect(result[2].order_index).toEqual(2);

    // Verify all fields are present
    result.forEach(image => {
      expect(image.id).toBeDefined();
      expect(image.project_id).toEqual(projectId);
      expect(image.filename).toBeDefined();
      expect(image.file_path).toBeDefined();
      expect(image.file_size).toBeGreaterThan(0);
      expect(image.mime_type).toEqual('image/jpeg');
      expect(image.uploaded_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array for project with no images', async () => {
    // Create test project
    const projectResult = await db.insert(videoProjectsTable)
      .values({
        name: 'Empty Project',
        duration_per_image: '2.00',
        fps: 30
      })
      .returning()
      .execute();

    const projectId = projectResult[0].id;

    // Fetch images for empty project
    const result = await getProjectImages(projectId);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent project', async () => {
    const nonExistentProjectId = 99999;

    // Fetch images for non-existent project
    const result = await getProjectImages(nonExistentProjectId);

    expect(result).toHaveLength(0);
  });

  it('should only return images for the specified project', async () => {
    // Create two test projects
    const project1Result = await db.insert(videoProjectsTable)
      .values({
        name: 'Project 1',
        duration_per_image: '2.00',
        fps: 30
      })
      .returning()
      .execute();

    const project2Result = await db.insert(videoProjectsTable)
      .values({
        name: 'Project 2',
        duration_per_image: '3.00',
        fps: 24
      })
      .returning()
      .execute();

    const project1Id = project1Result[0].id;
    const project2Id = project2Result[0].id;

    // Add images to both projects
    await db.insert(imagesTable).values([
      {
        project_id: project1Id,
        filename: 'project1_image1.jpg',
        file_path: '/uploads/project1_image1.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        order_index: 0
      },
      {
        project_id: project1Id,
        filename: 'project1_image2.jpg',
        file_path: '/uploads/project1_image2.jpg',
        file_size: 2048,
        mime_type: 'image/jpeg',
        order_index: 1
      },
      {
        project_id: project2Id,
        filename: 'project2_image1.jpg',
        file_path: '/uploads/project2_image1.jpg',
        file_size: 3072,
        mime_type: 'image/jpeg',
        order_index: 0
      }
    ]).execute();

    // Fetch images for project 1
    const result = await getProjectImages(project1Id);

    // Should only return images for project 1
    expect(result).toHaveLength(2);
    result.forEach(image => {
      expect(image.project_id).toEqual(project1Id);
      expect(image.filename).toMatch(/^project1_/);
    });
  });
});
