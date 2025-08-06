
import { z } from 'zod';

// Video project schema
export const videoProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  output_path: z.string().nullable(),
  duration_per_image: z.number(), // seconds per image
  fps: z.number(), // frames per second
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type VideoProject = z.infer<typeof videoProjectSchema>;

// Image schema
export const imageSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  filename: z.string(),
  file_path: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  order_index: z.number().int(),
  uploaded_at: z.coerce.date()
});

export type Image = z.infer<typeof imageSchema>;

// Input schema for creating video project
export const createVideoProjectInputSchema = z.object({
  name: z.string().min(1).max(255),
  duration_per_image: z.number().positive().default(2), // Default 2 seconds per image
  fps: z.number().int().min(1).max(60).default(30) // Default 30 fps
});

export type CreateVideoProjectInput = z.infer<typeof createVideoProjectInputSchema>;

// Input schema for uploading images
export const uploadImageInputSchema = z.object({
  project_id: z.number(),
  filename: z.string(),
  file_data: z.string(), // Base64 encoded image data
  mime_type: z.string(),
  order_index: z.number().int().nonnegative()
});

export type UploadImageInput = z.infer<typeof uploadImageInputSchema>;

// Input schema for generating video
export const generateVideoInputSchema = z.object({
  project_id: z.number()
});

export type GenerateVideoInput = z.infer<typeof generateVideoInputSchema>;

// Input schema for updating project status
export const updateProjectStatusInputSchema = z.object({
  project_id: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  output_path: z.string().nullable().optional()
});

export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusInputSchema>;
