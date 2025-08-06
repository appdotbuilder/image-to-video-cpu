
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

import { 
  createVideoProjectInputSchema, 
  uploadImageInputSchema, 
  generateVideoInputSchema, 
  updateProjectStatusInputSchema 
} from './schema';

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
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
