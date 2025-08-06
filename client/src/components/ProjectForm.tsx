
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { trpc } from '@/utils/trpc';
import type { CreateVideoProjectInput, VideoProject } from '../../../server/src/schema';

interface ProjectFormProps {
  onProjectCreated: (project: VideoProject) => void;
}

export function ProjectForm({ onProjectCreated }: ProjectFormProps) {
  const [formData, setFormData] = useState<CreateVideoProjectInput>({
    name: '',
    duration_per_image: 2,
    fps: 30
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsLoading(true);
    try {
      const newProject = await trpc.createVideoProject.mutate(formData);
      onProjectCreated(newProject);
      setFormData({
        name: '',
        duration_per_image: 2,
        fps: 30
      });
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev: CreateVideoProjectInput) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Enter a name for your video project..."
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Label>Duration per Image: {formData.duration_per_image} seconds</Label>
              <Slider
                value={[formData.duration_per_image]}
                onValueChange={([value]) =>
                  setFormData((prev: CreateVideoProjectInput) => ({ ...prev, duration_per_image: value }))
                }
                min={0.5}
                max={10}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>0.5s</span>
                <span>10s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Label>Frame Rate: {formData.fps} FPS</Label>
              <Slider
                value={[formData.fps]}
                onValueChange={([value]) =>
                  setFormData((prev: CreateVideoProjectInput) => ({ ...prev, fps: value }))
                }
                min={15}
                max={60}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>15 FPS</span>
                <span>60 FPS</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">📊 Video Preview</h4>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <span className="font-medium">Duration per image:</span> {formData.duration_per_image}s
          </div>
          <div>
            <span className="font-medium">Frame rate:</span> {formData.fps} FPS
          </div>
        </div>
        <p className="text-blue-600 text-sm mt-2">
          Each image will be displayed for {formData.duration_per_image} seconds at {formData.fps} frames per second
        </p>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !formData.name.trim()}
        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
      >
        {isLoading ? 'Creating Project...' : '🚀 Create Project'}
      </Button>
    </form>
  );
}
