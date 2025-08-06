
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videoProjectsTable, imagesTable } from '../db/schema';
import { type GenerateVideoInput } from '../schema';
import { generateVideo } from '../handlers/generate_video';
import { eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';

describe('generateVideo', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const setupTestProject = async () => {
    // Create test project
    const projects = await db.insert(videoProjectsTable)
      .values({
        name: 'Test Video Project',
        status: 'pending',
        duration_per_image: '2.5',
        fps: 24
      })
      .returning()
      .execute();

    const project = projects[0];

    // Create test image files
    const uploadsDir = path.join('uploads', 'images');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const imagePath1 = path.join(uploadsDir, 'test1.jpg');
    const imagePath2 = path.join(uploadsDir, 'test2.jpg');
    
    await fs.writeFile(imagePath1, Buffer.from('fake image 1'));
    await fs.writeFile(imagePath2, Buffer.from('fake image 2'));

    // Insert test images
    await db.insert(imagesTable)
      .values([
        {
          project_id: project.id,
          filename: 'test1.jpg',
          file_path: imagePath1,
          file_size: 1024,
          mime_type: 'image/jpeg',
          order_index: 0
        },
        {
          project_id: project.id,
          filename: 'test2.jpg',
          file_path: imagePath2,
          file_size: 2048,
          mime_type: 'image/jpeg',
          order_index: 1
        }
      ])
      .execute();

    return { project, imagePaths: [imagePath1, imagePath2] };
  };

  const cleanupFiles = async (paths: string[]) => {
    for (const filePath of paths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  };

  it('should generate video successfully', async () => {
    const { project } = await setupTestProject();
    
    const input: GenerateVideoInput = {
      project_id: project.id
    };

    const result = await generateVideo(input);

    // Verify returned project
    expect(result.id).toEqual(project.id);
    expect(result.name).toEqual('Test Video Project');
    expect(result.status).toEqual('completed');
    expect(result.output_path).toBeDefined();
    expect(result.output_path).toContain('.mp4');
    expect(result.duration_per_image).toEqual(2.5);
    expect(result.fps).toEqual(24);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify video file was created
    expect(result.output_path).toBeTruthy();
    const videoExists = await fs.access(result.output_path!)
      .then(() => true)
      .catch(() => false);
    expect(videoExists).toBe(true);

    // Cleanup
    if (result.output_path) {
      await cleanupFiles([result.output_path]);
    }
  });

  it('should update project status in database', async () => {
    const { project } = await setupTestProject();
    
    const input: GenerateVideoInput = {
      project_id: project.id
    };

    const result = await generateVideo(input);

    // Query database to verify status update
    const updatedProjects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, project.id))
      .execute();

    expect(updatedProjects).toHaveLength(1);
    const updatedProject = updatedProjects[0];
    expect(updatedProject.status).toEqual('completed');
    expect(updatedProject.output_path).toEqual(result.output_path);
    expect(updatedProject.updated_at).toBeInstanceOf(Date);

    // Cleanup
    if (result.output_path) {
      await cleanupFiles([result.output_path]);
    }
  });

  it('should handle non-existent project', async () => {
    const input: GenerateVideoInput = {
      project_id: 999
    };

    await expect(generateVideo(input)).rejects.toThrow(/project.*not found/i);
  });

  it('should handle project with no images', async () => {
    // Create project without images
    const projects = await db.insert(videoProjectsTable)
      .values({
        name: 'Empty Project',
        status: 'pending',
        duration_per_image: '2.0',
        fps: 30
      })
      .returning()
      .execute();

    const input: GenerateVideoInput = {
      project_id: projects[0].id
    };

    await expect(generateVideo(input)).rejects.toThrow(/no images found/i);

    // Verify project status was updated to failed
    const updatedProjects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, projects[0].id))
      .execute();

    expect(updatedProjects[0].status).toEqual('failed');
  });

  it('should handle missing image files', async () => {
    // Create project with image records but no actual files
    const projects = await db.insert(videoProjectsTable)
      .values({
        name: 'Missing Files Project',
        status: 'pending',
        duration_per_image: '2.0',
        fps: 30
      })
      .returning()
      .execute();

    await db.insert(imagesTable)
      .values({
        project_id: projects[0].id,
        filename: 'missing.jpg',
        file_path: '/non/existent/path.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        order_index: 0
      })
      .execute();

    const input: GenerateVideoInput = {
      project_id: projects[0].id
    };

    await expect(generateVideo(input)).rejects.toThrow(/image file not found/i);

    // Verify project status was updated to failed
    const updatedProjects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, projects[0].id))
      .execute();

    expect(updatedProjects[0].status).toEqual('failed');
  });

  it('should process images in correct order', async () => {
    // Create project with images in specific order
    const projects = await db.insert(videoProjectsTable)
      .values({
        name: 'Ordered Project',
        status: 'pending',
        duration_per_image: '1.0',
        fps: 30
      })
      .returning()
      .execute();

    const uploadsDir = path.join('uploads', 'images');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const imagePaths = [];
    for (let i = 0; i < 3; i++) {
      const imagePath = path.join(uploadsDir, `ordered_${i}.jpg`);
      await fs.writeFile(imagePath, Buffer.from(`image ${i}`));
      imagePaths.push(imagePath);
    }

    // Insert images with specific order indices
    await db.insert(imagesTable)
      .values([
        {
          project_id: projects[0].id,
          filename: 'ordered_2.jpg',
          file_path: imagePaths[2],
          file_size: 1024,
          mime_type: 'image/jpeg',
          order_index: 2
        },
        {
          project_id: projects[0].id,
          filename: 'ordered_0.jpg',
          file_path: imagePaths[0],
          file_size: 1024,
          mime_type: 'image/jpeg',
          order_index: 0
        },
        {
          project_id: projects[0].id,
          filename: 'ordered_1.jpg',
          file_path: imagePaths[1],
          file_size: 1024,
          mime_type: 'image/jpeg',
          order_index: 1
        }
      ])
      .execute();

    const input: GenerateVideoInput = {
      project_id: projects[0].id
    };

    const result = await generateVideo(input);

    expect(result.status).toEqual('completed');
    expect(result.output_path).toBeDefined();

    // Cleanup
    await cleanupFiles(imagePaths);
    if (result.output_path) {
      await cleanupFiles([result.output_path]);
    }
  });
});
