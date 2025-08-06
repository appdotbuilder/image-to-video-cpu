
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { VideoIcon, ImageIcon, PlusIcon, PlayIcon } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { ProjectForm } from '@/components/ProjectForm';
import { ImageUploader } from '@/components/ImageUploader';
import { ProjectList } from '@/components/ProjectList';
import type { VideoProject, Image } from '../../server/src/schema';

function App() {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<VideoProject | null>(null);
  const [projectImages, setProjectImages] = useState<Image[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load all projects
  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const result = await trpc.getVideoProjects.query();
      setProjects(result);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Load images for selected project
  const loadProjectImages = useCallback(async (projectId: number) => {
    setIsLoadingImages(true);
    try {
      const result = await trpc.getProjectImages.query({ projectId });
      setProjectImages(result);
    } catch (error) {
      console.error('Failed to load project images:', error);
    } finally {
      setIsLoadingImages(false);
    }
  }, []);

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load images when project is selected
  useEffect(() => {
    if (selectedProject) {
      loadProjectImages(selectedProject.id);
    } else {
      setProjectImages([]);
    }
  }, [selectedProject, loadProjectImages]);

  // Handle project creation
  const handleProjectCreated = useCallback((newProject: VideoProject) => {
    setProjects((prev: VideoProject[]) => [...prev, newProject]);
    setSelectedProject(newProject);
  }, []);

  // Handle image upload
  const handleImageUploaded = useCallback((newImage: Image) => {
    setProjectImages((prev: Image[]) => [...prev, newImage].sort((a, b) => a.order_index - b.order_index));
  }, []);

  // Handle project selection
  const handleProjectSelect = useCallback((project: VideoProject) => {
    setSelectedProject(project);
  }, []);

  // Generate video
  const handleGenerateVideo = useCallback(async () => {
    if (!selectedProject) return;
    
    setIsGenerating(true);
    try {
      const updatedProject = await trpc.generateVideo.mutate({ project_id: selectedProject.id });
      setSelectedProject(updatedProject);
      setProjects((prev: VideoProject[]) => 
        prev.map((p: VideoProject) => p.id === updatedProject.id ? updatedProject : p)
      );
    } catch (error) {
      console.error('Failed to generate video:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProject]);

  const getStatusColor = (status: VideoProject['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <VideoIcon className="h-10 w-10 text-purple-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🎬 Image to Video Converter
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Transform your images into stunning videos with custom timing and frame rates
          </p>
        </div>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <VideoIcon className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              Create Project
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2" disabled={!selectedProject}>
              <ImageIcon className="h-4 w-4" />
              Upload Images
            </TabsTrigger>
          </TabsList>

          {/* Projects List Tab */}
          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <VideoIcon className="h-5 w-5" />
                  Your Video Projects
                </CardTitle>
                <CardDescription>
                  Manage your image-to-video conversion projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectList
                  projects={projects}
                  isLoading={isLoadingProjects}
                  onProjectSelect={handleProjectSelect}
                  selectedProject={selectedProject}
                  getStatusColor={getStatusColor}
                />
              </CardContent>
            </Card>

            {/* Selected Project Details */}
            {selectedProject && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        🎯 {selectedProject.name}
                        <Badge className={`text-white ${getStatusColor(selectedProject.status)}`}>
                          {selectedProject.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Created on {selectedProject.created_at.toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleGenerateVideo}
                      disabled={isGenerating || projectImages.length === 0 || selectedProject.status === 'processing'}
                      className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      {isGenerating ? 'Generating...' : 'Generate Video'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="font-semibold text-purple-700">Duration per Image</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedProject.duration_per_image}s
                      </div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="font-semibold text-blue-700">Frame Rate</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedProject.fps} FPS
                      </div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="font-semibold text-green-700">Images</div>
                      <div className="text-2xl font-bold text-green-600">
                        {projectImages.length}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="font-semibold text-orange-700">Total Duration</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {(projectImages.length * selectedProject.duration_per_image).toFixed(1)}s
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Project Images ({projectImages.length})
                    </h3>
                    {isLoadingImages ? (
                      <div className="text-center py-8 text-gray-500">Loading images...</div>
                    ) : projectImages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No images uploaded yet. Go to the Upload Images tab to add some! 📸
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {projectImages.map((image: Image) => (
                          <div key={image.id} className="bg-white rounded-lg shadow-sm border p-2">
                            <div className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="text-xs text-gray-600 truncate" title={image.filename}>
                              {image.filename}
                            </div>
                            <div className="text-xs text-gray-400">
                              Order: {image.order_index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedProject.output_path && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-2">✅ Video Generated!</h4>
                      <p className="text-green-700 text-sm">
                        Your video has been successfully generated and saved to: {selectedProject.output_path}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Create Project Tab */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusIcon className="h-5 w-5" />
                  Create New Video Project
                </CardTitle>
                <CardDescription>
                  Set up a new project with custom video settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectForm onProjectCreated={handleProjectCreated} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload Images Tab */}
          <TabsContent value="upload">
            {selectedProject ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Upload Images to "{selectedProject.name}"
                  </CardTitle>
                  <CardDescription>
                    Add images to your project in the order they should appear in the video
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageUploader
                    project={selectedProject}
                    existingImages={projectImages}
                    onImageUploaded={handleImageUploaded}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Please select a project first to upload images
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
