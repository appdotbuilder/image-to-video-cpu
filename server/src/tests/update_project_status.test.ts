
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videoProjectsTable } from '../db/schema';
import { type CreateVideoProjectInput, type UpdateProjectStatusInput } from '../schema';
import { updateProjectStatus } from '../handlers/update_project_status';
import { eq } from 'drizzle-orm';

// Test input for creating a project
const testProjectInput: CreateVideoProjectInput = {
  name: 'Test Project',
  duration_per_image: 3.0,
  fps: 24
};

// Test input for updating status
const testStatusInput: UpdateProjectStatusInput = {
  project_id: 1,
  status: 'completed',
  output_path: '/videos/output.mp4'
};

describe('updateProjectStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update project status and output path', async () => {
    // Create a test project first
    const createResult = await db.insert(videoProjectsTable)
      .values({
        name: testProjectInput.name,
        duration_per_image: testProjectInput.duration_per_image.toString(),
        fps: testProjectInput.fps
      })
      .returning()
      .execute();

    const projectId = createResult[0].id;

    // Update the project status
    const updateInput = {
      ...testStatusInput,
      project_id: projectId
    };

    const result = await updateProjectStatus(updateInput);

    // Verify the result
    expect(result.id).toEqual(projectId);
    expect(result.status).toEqual('completed');
    expect(result.output_path).toEqual('/videos/output.mp4');
    expect(result.name).toEqual('Test Project');
    expect(typeof result.duration_per_image).toBe('number');
    expect(result.duration_per_image).toEqual(3.0);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update project status without output path', async () => {
    // Create a test project first
    const createResult = await db.insert(videoProjectsTable)
      .values({
        name: testProjectInput.name,
        duration_per_image: testProjectInput.duration_per_image.toString(),
        fps: testProjectInput.fps
      })
      .returning()
      .execute();

    const projectId = createResult[0].id;

    // Update only the status
    const updateInput: UpdateProjectStatusInput = {
      project_id: projectId,
      status: 'processing'
    };

    const result = await updateProjectStatus(updateInput);

    // Verify the result
    expect(result.id).toEqual(projectId);
    expect(result.status).toEqual('processing');
    expect(result.output_path).toBeNull();
    expect(result.name).toEqual('Test Project');
    expect(typeof result.duration_per_image).toBe('number');
  });

  it('should save updated status to database', async () => {
    // Create a test project first
    const createResult = await db.insert(videoProjectsTable)
      .values({
        name: testProjectInput.name,
        duration_per_image: testProjectInput.duration_per_image.toString(),
        fps: testProjectInput.fps
      })
      .returning()
      .execute();

    const projectId = createResult[0].id;

    // Update the project
    const updateInput = {
      ...testStatusInput,
      project_id: projectId
    };

    await updateProjectStatus(updateInput);

    // Query database to verify changes were persisted
    const projects = await db.select()
      .from(videoProjectsTable)
      .where(eq(videoProjectsTable.id, projectId))
      .execute();

    expect(projects).toHaveLength(1);
    expect(projects[0].status).toEqual('completed');
    expect(projects[0].output_path).toEqual('/videos/output.mp4');
    expect(projects[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent project', async () => {
    const updateInput: UpdateProjectStatusInput = {
      project_id: 999,
      status: 'completed'
    };

    await expect(updateProjectStatus(updateInput)).rejects.toThrow(/project with id 999 not found/i);
  });

  it('should update status to failed', async () => {
    // Create a test project first
    const createResult = await db.insert(videoProjectsTable)
      .values({
        name: testProjectInput.name,
        duration_per_image: testProjectInput.duration_per_image.toString(),
        fps: testProjectInput.fps
      })
      .returning()
      .execute();

    const projectId = createResult[0].id;

    // Update to failed status
    const updateInput: UpdateProjectStatusInput = {
      project_id: projectId,
      status: 'failed'
    };

    const result = await updateProjectStatus(updateInput);

    expect(result.status).toEqual('failed');
    expect(result.output_path).toBeNull();
  });
});
