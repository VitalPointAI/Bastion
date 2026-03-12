/**
 * CreateGroupModal
 *
 * Modal for creating a new resource group. Uses react-hook-form + zod for
 * validation (consistent with ResourceForm pattern).
 *
 * Phase 42 Plan 05: Groups sub-view — create group modal.
 */

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { resourceRegistryService, type ResourceGroup } from '../../../lib/resource-registry-service';

const createGroupSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be 50 characters or fewer'),
  groupType: z.enum(['task_force', 'support', 'reserve', 'custom']),
  description: z.string().optional(),
});

type CreateGroupFormData = z.infer<typeof createGroupSchema>;

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: ResourceGroup) => void;
  problemSetId: string;
}

export function CreateGroupModal({ isOpen, onClose, onCreated, problemSetId }: CreateGroupModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: '',
      groupType: 'task_force',
      description: '',
    },
  });

  if (!isOpen) return null;

  async function onSubmit(data: CreateGroupFormData) {
    try {
      const result = await resourceRegistryService.createGroup({
        missionId: problemSetId,
        name: data.name,
        groupType: data.groupType,
      });
      reset();
      onCreated(result);
      onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Create Resource Group</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              {...register('name')}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g., Task Force Alpha"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Type <span className="text-red-400">*</span>
            </label>
            <select
              {...register('groupType')}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="task_force">Task Force</option>
              <option value="support">Support</option>
              <option value="reserve">Reserve</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Brief description of this group's role..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
