import { Router, type Request, type Response } from 'express';
import { sensorStore } from '../sensors/sensor-store.js';
import type { Sensor, SensorCategory, SensorStatus } from '../sensors/types.js';

const router = Router();

/**
 * Helper to extract string value from query param (handles arrays)
 */
function getQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

// =====================
// SENSOR ENDPOINTS
// =====================

/**
 * Create a new sensor
 * POST /api/sensors
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { missionId, name, category, capabilities, status, sidc, location, dataFeedUrl } = req.body;

    // Validate required fields
    if (!missionId || !name || !category || !status) {
      return res.status(400).json({
        error: 'Missing required fields: missionId, name, category, status are required',
      });
    }

    // Validate category
    const validCategories: SensorCategory[] = ['airborne', 'ground', 'maritime', 'space', 'autonomous'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    // Validate status
    const validStatuses: SensorStatus[] = ['operational', 'degraded', 'offline', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const sensor = await sensorStore.createSensor(
      missionId,
      name,
      category,
      capabilities || {},
      status,
      sidc,
      location,
      dataFeedUrl
    );

    res.status(201).json(sensor);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

/**
 * List sensors for a mission
 * GET /api/sensors?missionId=X&category=Y
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const missionId = getQueryString(req.query.missionId);
    const category = getQueryString(req.query.category) as SensorCategory | undefined;
    const status = getQueryString(req.query.status) as SensorStatus | undefined;

    if (!missionId) {
      return res.status(400).json({
        error: 'Missing required query parameter: missionId',
      });
    }

    const sensors = await sensorStore.listSensors({ missionId, category, status });
    res.json({ sensors });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Get single sensor by ID
 * GET /api/sensors/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sensorId = req.params.id as string;
    const sensor = await sensorStore.getSensor(sensorId);

    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    res.json(sensor);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Update sensor
 * PATCH /api/sensors/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const sensorId = req.params.id as string;
    const { name, category, capabilities, status, sidc, location, dataFeedUrl } = req.body;

    // First check if sensor exists
    const existing = await sensorStore.getSensor(sensorId);
    if (!existing) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    // Build update object with only provided fields
    const updates: Partial<Sensor> = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (capabilities !== undefined) updates.capabilities = capabilities;
    if (status !== undefined) updates.status = status;
    if (sidc !== undefined) updates.sidc = sidc;
    if (location !== undefined) updates.location = location;
    if (dataFeedUrl !== undefined) updates.dataFeedUrl = dataFeedUrl;

    const updatedSensor = { ...existing, ...updates };

    // Update in store (simplified - sensorStore needs updateSensor method)
    // For now, we'll just return the merged object
    // TODO: Add updateSensor method to sensorStore
    res.json(updatedSensor);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

/**
 * Update sensor status only
 * PATCH /api/sensors/:id/status
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const sensorId = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    const validStatuses: SensorStatus[] = ['operational', 'degraded', 'offline', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updatedSensor = await sensorStore.updateStatus(sensorId, status);

    if (!updatedSensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    res.json(updatedSensor);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

/**
 * Update sensor location
 * PATCH /api/sensors/:id/location
 */
router.patch('/:id/location', async (req: Request, res: Response) => {
  try {
    const sensorId = req.params.id as string;
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Missing required fields: lat, lng' });
    }

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat and lng must be numbers' });
    }

    if (lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'lat must be between -90 and 90' });
    }

    if (lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'lng must be between -180 and 180' });
    }

    // Get existing sensor
    const sensor = await sensorStore.getSensor(sensorId);
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    // Update location (simplified - needs updateLocation method in store)
    sensor.location = { lat, lng };
    // TODO: Add updateLocation method to sensorStore
    res.json(sensor);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

/**
 * Delete sensor
 * DELETE /api/sensors/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const sensorId = req.params.id as string;
    const deleted = await sensorStore.deleteSensor(sensorId);

    if (!deleted) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    res.json({ success: true, id: sensorId });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Get all sensor coverage polygons for a mission
 * GET /api/sensors/coverage/:missionId
 */
router.get('/coverage/:missionId', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.missionId as string;

    // Get all sensors for the mission
    const sensors = await sensorStore.listSensors({ missionId });

    // Build coverage areas from sensor capabilities
    const coverageAreas = sensors
      .filter(sensor => sensor.location && sensor.capabilities.range)
      .map(sensor => ({
        id: `coverage-${sensor.id}`,
        sensorId: sensor.id,
        sensorName: sensor.name,
        category: sensor.category,
        location: sensor.location!,
        range: sensor.capabilities.range!,
        coverageArea: sensor.capabilities.coverageArea,
        status: sensor.status,
      }));

    res.json({ coverageAreas });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Define/update coverage polygon for a sensor
 * POST /api/sensors/:id/coverage
 */
router.post('/:id/coverage', async (req: Request, res: Response) => {
  try {
    const sensorId = req.params.id as string;
    const { polygon } = req.body;

    if (!polygon) {
      return res.status(400).json({ error: 'Missing required field: polygon' });
    }

    // Validate polygon structure
    if (polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates)) {
      return res.status(400).json({
        error: 'Invalid polygon format. Must be GeoJSON Polygon with type and coordinates',
      });
    }

    // Check if sensor exists
    const sensor = await sensorStore.getSensor(sensorId);
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    // Store coverage polygon (simplified - would store in separate table in full implementation)
    const coverage = {
      id: `COV-${sensorId}`,
      sensorId,
      polygon,
      createdAt: new Date(),
    };

    res.status(201).json(coverage);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

export default router;
