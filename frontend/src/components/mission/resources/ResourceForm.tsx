/**
 * Resource Form Component
 *
 * Modal form for creating/editing resources.
 * Supports equipment with category, status, serial number, location.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  resourceService,
  getCategoryName,
  type Resource,
  type ResourceCategory,
  type ResourceStatus,
} from '../../../lib/resource-service.js';

// Zod schema for validation
const resourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['vehicles', 'weapons', 'communications', 'sensors', 'medical', 'other']),
  serialNumber: z.string().optional(),
  status: z.enum(['FMC', 'PMC', 'NMC']),
  location: z.string().optional(),
  specifications: z.string().optional(), // JSON string
});

type ResourceFormData = z.infer<typeof resourceSchema>;

interface ResourceFormProps {
  missionId: string;
  resource?: Resource | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResourceForm({ missionId, resource, onClose, onSuccess }: ResourceFormProps) {
  const isEditing = !!resource;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResourceFormData>({
    defaultValues: {
      name: resource?.name || '',
      category: resource?.category || 'other',
      serialNumber: resource?.serialNumber || '',
      status: resource?.status || 'FMC',
      location: resource?.location || '',
      specifications: resource?.specifications ? JSON.stringify(resource.specifications, null, 2) : '',
    },
  });

  useEffect(() => {
    if (resource) {
      reset({
        name: resource.name,
        category: resource.category,
        serialNumber: resource.serialNumber || '',
        status: resource.status,
        location: resource.location || '',
        specifications: resource.specifications ? JSON.stringify(resource.specifications, null, 2) : '',
      });
    }
  }, [resource, reset]);

  const onSubmit = async (data: ResourceFormData) => {
    try {
      // Parse specifications if provided
      let specifications: Record<string, unknown> | undefined;
      if (data.specifications && data.specifications.trim()) {
        try {
          specifications = JSON.parse(data.specifications);
        } catch (err) {
          alert('Invalid JSON in specifications field');
          return;
        }
      }

      const payload = {
        missionId,
        name: data.name,
        category: data.category,
        serialNumber: data.serialNumber || undefined,
        status: data.status,
        location: data.location || undefined,
        specifications,
      };

      if (isEditing && resource) {
        await resourceService.updateResource(resource.id, payload);
      } else {
        await resourceService.createResource(payload);
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to save resource:', err);
      alert(err instanceof Error ? err.message : 'Failed to save resource');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const categories: ResourceCategory[] = ['vehicles', 'weapons', 'communications', 'sensors', 'medical', 'other'];
  const statuses: ResourceStatus[] = ['FMC', 'PMC', 'NMC'];

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content resource-form-modal">
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Resource' : 'Add Resource'}</h2>
          <button onClick={onClose} className="modal-close" type="button">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="resource-form">
          <div className="form-group">
            <label htmlFor="name">
              Resource Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              {...register('name')}
              className={errors.name ? 'error' : ''}
              placeholder="e.g., M1A2 Abrams Tank"
            />
            {errors.name && <span className="error-message">{errors.name.message}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">
                Category <span className="required">*</span>
              </label>
              <select id="category" {...register('category')} className={errors.category ? 'error' : ''}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryName(cat)}
                  </option>
                ))}
              </select>
              {errors.category && <span className="error-message">{errors.category.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="status">
                Status <span className="required">*</span>
              </label>
              <select id="status" {...register('status')} className={errors.status ? 'error' : ''}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {errors.status && <span className="error-message">{errors.status.message}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="serialNumber">Serial Number</label>
              <input
                type="text"
                id="serialNumber"
                {...register('serialNumber')}
                placeholder="e.g., SN-12345"
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                {...register('location')}
                placeholder="e.g., Motor Pool Alpha"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="specifications">
              Specifications (JSON)
              <span className="help-text">Optional technical specifications in JSON format</span>
            </label>
            <textarea
              id="specifications"
              {...register('specifications')}
              rows={6}
              placeholder='{ "max_speed": "42 mph", "crew": 4, "armament": "120mm M256 smoothbore" }'
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
