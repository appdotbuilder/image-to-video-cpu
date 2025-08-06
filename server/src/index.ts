
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { IncomingMessage, ServerResponse } from 'http';

import { 
  createVideoProjectInputSchema, 
  uploadImageInputSchema, 
  generateVideoInputSchema, 
  updateProjectStatusInputSchema 
} from './schema';
import { db } from './db';
import { videoProjectsTable } from './db/schema';
import { eq } from 'drizzle-orm';

import { createVideoProject } from './handlers/create_video_project';
import { uploadImage } from './handlers/upload_image';
import { getVideoProjects } from './handlers/get_video_projects';
import { getProjectImages } from './handlers/get_project_images';
import { generateVideo } from './handlers/generate_video';
import { updateProjectStatus } from './handlers/update_project_status';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Create a new video project
  createVideoProject: publicProcedure
    .input(createVideoProjectInputSchema)
    .mutation(({ input }) => createVideoProject(input)),

  // Upload an image to a project
  uploadImage: publicProcedure
    .input(uploadImageInputSchema)
    .mutation(({ input }) => uploadImage(input)),

  // Get all video projects
  getVideoProjects: publicProcedure
    .query(() => getVideoProjects()),

  // Get all images for a specific project
  getProjectImages: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(({ input }) => getProjectImages(input.projectId)),

  // Generate video from project images
  generateVideo: publicProcedure
    .input(generateVideoInputSchema)
    .mutation(({ input }) => generateVideo(input)),

  // Update project status
  updateProjectStatus: publicProcedure
    .input(updateProjectStatusInputSchema)
    .mutation(({ input }) => updateProjectStatus(input)),

  // Get download URL for generated video
  getVideoDownloadUrl: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      // Find the project and return its video download URL
      const projects = await db.select()
        .from(videoProjectsTable)
        .where(eq(videoProjectsTable.id, input.projectId))
        .execute();
      
      if (projects.length === 0) {
        throw new Error(`Project with id ${input.projectId} not found`);
      }
      
      const project = projects[0];
      
      if (!project.output_path) {
        throw new Error(`Video not yet generated for project ${input.projectId}`);
      }
      
      // Return relative URL that will be handled by our static file server
      const filename = path.basename(project.output_path);
      return { downloadUrl: `/videos/${filename}` };
    }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      // Enable CORS for all requests
      cors()(req, res, () => {
        // Handle video file downloads
        if (req.url?.startsWith('/videos/')) {
          handleVideoDownload(req, res);
          return;
        }
        next();
      });
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

/**
 * Handle static video file serving
 */
async function handleVideoDownload(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!req.url) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request');
      return;
    }

    // Extract filename from URL path
    const urlPath = req.url;
    const filename = path.basename(urlPath);
    
    // Construct full file path
    const videoPath = path.join('uploads', 'videos', filename);
    
    // Check if file exists
    try {
      await fs.access(videoPath);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Video file not found');
      return;
    }

    // Get file stats for content length
    const stats = await fs.stat(videoPath);
    
    // Set appropriate headers for video download
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Stream the file
    const fileData = await fs.readFile(videoPath);
    res.end(fileData);
    
  } catch (error) {
    console.error('Error serving video file:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

start();
