
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoIcon, ClockIcon, ZapIcon } from 'lucide-react';
import type { VideoProject } from '../../../server/src/schema';

interface ProjectListProps {
  projects: VideoProject[];
  isLoading: boolean;
  onProjectSelect: (project: VideoProject) => void;
  selectedProject: VideoProject | null;
  getStatusColor: (status: VideoProject['status']) => string;
}

export function ProjectList({
  projects,
  isLoading,
  onProjectSelect,
  selectedProject,
  getStatusColor
}: ProjectListProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
        <p className="text-gray-500 mt-4">Loading your projects...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <VideoIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No video projects yet!</p>
        <p className="text-sm text-gray-400">Create your first project to get started 🎬</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project: VideoProject) => (
        <Card
          key={project.id}
          className={`cursor-pointer transition-all hover:shadow-lg ${
            selectedProject?.id === project.id
              ? 'ring-2 ring-purple-500 bg-purple-50'
              : 'hover:bg-gray-50'
          }`}
          onClick={() => onProjectSelect(project)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <VideoIcon className="h-5 w-5 text-purple-600" />
                {project.name}
              </CardTitle>
              <Badge className={`text-white text-xs ${getStatusColor(project.status)}`}>
                {project.status}
              </Badge>
            </div>
            <CardDescription>
              Created {project.created_at.toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <ClockIcon className="h-4 w-4" />
                {project.duration_per_image}s per image
              </div>
              <div className="flex items-center gap-1">
                <ZapIcon className="h-4 w-4" />
                {project.fps} FPS
              </div>
            </div>
            
            {project.output_path && (
              <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                ✅ Video ready: {project.output_path}
              </div>
            )}
            
            <Button
              variant={selectedProject?.id === project.id ? "secondary" : "outline"}
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onProjectSelect(project);
              }}
            >
              {selectedProject?.id === project.id ? 'Selected' : 'Select Project'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
