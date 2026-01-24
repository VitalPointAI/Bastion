/**
 * Sensor Service
 *
 * Phase 4.4 Plan 08: Sensor API client for frontend
 */

const API_BASE = '/api/sensors';

export interface SensorCapabilities {
  range?: number;
  resolution?: number;
  coverageArea?: number;
  sensorTypes?: string[];
  updateRate?: number;
}

export type SensorCategory = 'airborne' | 'ground' | 'maritime' | 'space' | 'autonomous';
export type SensorStatus = 'operational' | 'degraded' | 'offline' | 'maintenance';

export interface Sensor {
  id: string;
  missionId: string;
  name: string;
  category: SensorCategory;
  sidc?: string;
  capabilities: SensorCapabilities;
  status: SensorStatus;
  location?: {
    lat: number;
    lng: number;
  };
  dataFeedUrl?: string;
  createdAt: Date;
}

export interface SensorInput {
  missionId: string;
  name: string;
  category: SensorCategory;
  capabilities?: SensorCapabilities;
  status: SensorStatus;
  sidc?: string;
  location?: {
    lat: number;
    lng: number;
  };
  dataFeedUrl?: string;
}

export interface CoverageArea {
  id: string;
  sensorId: string;
  sensorName: string;
  category: SensorCategory;
  location: {
    lat: number;
    lng: number;
  };
  range: number;
  coverageArea?: number;
  status: SensorStatus;
}

export const sensorService = {
  /**
   * Create a new sensor
   */
  async createSensor(data: SensorInput): Promise<Sensor> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create sensor');
    }

    return response.json();
  },

  /**
   * Get sensors for a mission
   */
  async getSensors(missionId: string, category?: SensorCategory): Promise<Sensor[]> {
    const params = new URLSearchParams({ missionId });
    if (category) {
      params.append('category', category);
    }

    const response = await fetch(`${API_BASE}?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch sensors');
    }

    const data = await response.json();
    return data.sensors || [];
  },

  /**
   * Get single sensor by ID
   */
  async getSensor(id: string): Promise<Sensor> {
    const response = await fetch(`${API_BASE}/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch sensor');
    }

    return response.json();
  },

  /**
   * Update sensor
   */
  async updateSensor(id: string, data: Partial<SensorInput>): Promise<Sensor> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update sensor');
    }

    return response.json();
  },

  /**
   * Update sensor status only
   */
  async updateStatus(id: string, status: SensorStatus): Promise<Sensor> {
    const response = await fetch(`${API_BASE}/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update sensor status');
    }

    return response.json();
  },

  /**
   * Update sensor location
   */
  async updateLocation(id: string, lat: number, lng: number): Promise<Sensor> {
    const response = await fetch(`${API_BASE}/${id}/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update sensor location');
    }

    return response.json();
  },

  /**
   * Delete sensor
   */
  async deleteSensor(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete sensor');
    }
  },

  /**
   * Get coverage areas for a mission
   */
  async getCoverage(missionId: string): Promise<CoverageArea[]> {
    const response = await fetch(`${API_BASE}/coverage/${missionId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch coverage areas');
    }

    const data = await response.json();
    return data.coverageAreas || [];
  },

  /**
   * Update coverage polygon for a sensor
   */
  async updateCoverage(id: string, polygon: unknown): Promise<unknown> {
    const response = await fetch(`${API_BASE}/${id}/coverage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ polygon }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update coverage');
    }

    return response.json();
  },
};
