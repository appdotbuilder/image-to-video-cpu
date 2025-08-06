
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videoProjectsTable } from '../db/schema';
import { type CreateVideoProjectInput } from '../schema';
import { createVideoProject } from '../handlers/create_video_project';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateVideoProjectInput = {
  name: 'Test Video Project',
  duration_per_image: 2.5,
  fps: 24
};

describe('createVideoProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a video project with specified values', async () => {
    const result = await createVideoProject(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Video Project');
    expect(result.duration_per_image).toEqual(2.5);
    expect(result.fps).toEqual(24);
    expect(result.status).toEqual('pending');
    expect(result.output_path).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(typeof result.duration_per_image).toBe('number');
  });

  it('should create a video project with default values', async () => {
    const inputWithDefaults: CreateVideoProjectInput = {
      name: 'Project With Defaults',
      duration_per_image: 2, // default value
      fps: 30 // default value
    };

    const result = await createVideoProject(inputWithDefaults);

    expect(result.name).toEqual('Project With Defaults');
    expect(result.duration_per_image).toEqual(2);
    expect(result.fps).toEqual(30);
    expect(result.status).toEqual('pending');
  });

  it('should save video project to database', async () => {
    const result = await createVideoProject(testInput);

    // Query using proper drizzle syntax
    const projects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, result.id))
      .execute();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toEqual('Test Video Project');
    expect(parseFloat(projects[0].duration_per_image)).toEqual(2.5);
    expect(projects[0].fps).toEqual(24);
    expect(projects[0].status).toEqual('pending');
    expect(projects[0].output_path).toBeNull();
    expect(projects[0].created_at).toBeInstanceOf(Date);
    expect(projects[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle different fps values correctly', async () => {
    const highFpsInput: CreateVideoProjectInput = {
      name: 'High FPS Project',
      duration_per_image: 1.0,
      fps: 60
    };

    const result = await createVideoProject(highFpsInput);

    expect(result.fps).toEqual(60);
    expect(result.duration_per_image).toEqual(1.0);

    // Verify in database
    const projects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, result.id))
      .execute();

    expect(projects[0].fps).toEqual(60);
    expect(parseFloat(projects[0].duration_per_image)).toEqual(1.0);
  });
});
