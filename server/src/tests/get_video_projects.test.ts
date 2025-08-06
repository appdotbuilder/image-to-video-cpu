
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videoProjectsTable } from '../db/schema';
import { type CreateVideoProjectInput } from '../schema';
import { getVideoProjects } from '../handlers/get_video_projects';

// Test data for creating video projects
const testProject1: CreateVideoProjectInput = {
  name: 'Test Project 1',
  duration_per_image: 2.5,
  fps: 30
};

const testProject2: CreateVideoProjectInput = {
  name: 'Test Project 2',
  duration_per_image: 1.0,
  fps: 24
};

describe('getVideoProjects', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no projects exist', async () => {
    const result = await getVideoProjects();

    expect(result).toEqual([]);
  });

  it('should return all video projects', async () => {
    // Create test projects
    await db.insert(videoProjectsTable)
      .values([
        {
          name: testProject1.name,
          duration_per_image: testProject1.duration_per_image.toString(),
          fps: testProject1.fps
        },
        {
          name: testProject2.name,
          duration_per_image: testProject2.duration_per_image.toString(),
          fps: testProject2.fps
        }
      ])
      .execute();

    const result = await getVideoProjects();

    expect(result).toHaveLength(2);

    // Verify first project
    const project1 = result.find(p => p.name === 'Test Project 1');
    expect(project1).toBeDefined();
    expect(project1!.duration_per_image).toEqual(2.5);
    expect(typeof project1!.duration_per_image).toBe('number');
    expect(project1!.fps).toEqual(30);
    expect(project1!.status).toEqual('pending'); // default value
    expect(project1!.output_path).toBeNull();
    expect(project1!.id).toBeDefined();
    expect(project1!.created_at).toBeInstanceOf(Date);
    expect(project1!.updated_at).toBeInstanceOf(Date);

    // Verify second project
    const project2 = result.find(p => p.name === 'Test Project 2');
    expect(project2).toBeDefined();
    expect(project2!.duration_per_image).toEqual(1.0);
    expect(typeof project2!.duration_per_image).toBe('number');
    expect(project2!.fps).toEqual(24);
    expect(project2!.status).toEqual('pending');
  });

  it('should return projects with different statuses', async () => {
    // Create projects with different statuses
    await db.insert(videoProjectsTable)
      .values([
        {
          name: 'Pending Project',
          duration_per_image: '2.00',
          fps: 30,
          status: 'pending'
        },
        {
          name: 'Completed Project',
          duration_per_image: '3.00',
          fps: 25,
          status: 'completed',
          output_path: '/videos/output.mp4'
        }
      ])
      .execute();

    const result = await getVideoProjects();

    expect(result).toHaveLength(2);

    const pendingProject = result.find(p => p.status === 'pending');
    expect(pendingProject).toBeDefined();
    expect(pendingProject!.output_path).toBeNull();

    const completedProject = result.find(p => p.status === 'completed');
    expect(completedProject).toBeDefined();
    expect(completedProject!.output_path).toEqual('/videos/output.mp4');
  });
});
